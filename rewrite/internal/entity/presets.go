package entity

import (
	"context"
	"encoding/json"
	"strings"
)

var presetReadSpec = &Spec{
	Blobs: []string{"signatureData", "businessLogo", "qrCode", "styleProfileWatermarkFileData", "styleProfilePaidWatermarkFileData"},
}

const presetJoins = `
FROM presets t
LEFT JOIN style_profiles sp ON sp."id" = t."styleProfilesId"
LEFT JOIN layouts l ON l."id" = sp."layoutId"
LEFT JOIN banks ba ON ba."id" = t."bankId"
LEFT JOIN currencies cur ON cur."id" = t."currencyId"
LEFT JOIN clients cl ON cl."id" = t."clientId"
LEFT JOIN businesses bu ON bu."id" = t."businessId"`

// Columns a preset borrows from the records it points at, as "alias.column AS name".
var presetBorrowed = []string{
	`bu."name" AS "businessName"`, `bu."address" AS "businessAddress"`, `bu."role" AS "businessRole"`,
	`bu."shortName" AS "businessShortName"`, `bu."email" AS "businessEmail"`, `bu."phone" AS "businessPhone"`,
	`bu."additional" AS "businessAdditional"`, `bu."logo" AS "businessLogo"`, `bu."fileSize" AS "businessFileSize"`,
	`bu."fileType" AS "businessFileType"`, `bu."fileName" AS "businessFileName"`, `bu."vatCode" AS "businessVatCode"`,
	`cl."name" AS "clientName"`, `cl."address" AS "clientAddress"`, `cl."email" AS "clientEmail"`,
	`cl."phone" AS "clientPhone"`, `cl."code" AS "clientCode"`, `cl."additional" AS "clientAdditional"`,
	`cl."vatCode" AS "clientVatCode"`,
	`cur."code" AS "currencyCode"`, `cur."symbol" AS "currencySymbol"`, `cur."subunit" AS "currencySubunit"`,
	`cur."format" AS "currencyFormat"`,
	`ba."name" AS "bankLabel"`, `ba."bankName" AS "bankName"`, `ba."accountNumber" AS "accountNumber"`,
	`ba."swiftCode" AS "swiftCode"`, `ba."address" AS "address"`, `ba."branchCode" AS "branchCode"`,
	`ba."type" AS "type"`, `ba."routingNumber" AS "routingNumber"`, `ba."accountHolder" AS "accountHolder"`,
	`ba."sortOrder" AS "sortOrder"`, `ba."upiCode" AS "upiCode"`, `ba."qrCodeFileSize" AS "qrCodeFileSize"`,
	`ba."qrCodeFileType" AS "qrCodeFileType"`, `ba."qrCodeFileName" AS "qrCodeFileName"`, `ba."qrCode" AS "qrCode"`,
	`l."id" AS "layoutId"`, `l."schema" AS "layoutSchema"`,
	`sp."name" AS "styleProfileName"`, `sp."color" AS "styleProfileColor"`, `sp."logoSize" AS "styleProfileLogoSize"`,
	`sp."fontSize" AS "styleProfileFontSize"`, `sp."fontFamily" AS "styleProfileFontFamily"`,
	`sp."tableHeaderStyle" AS "styleProfileTableHeaderStyle"`, `sp."tableRowStyle" AS "styleProfileTableRowStyle"`,
	`sp."pageFormat" AS "styleProfilePageFormat"`, `sp."labelUpperCase" AS "styleProfileLabelUpperCase"`,
	`sp."showQuantity" AS "styleProfileShowQuantity"`, `sp."showUnit" AS "styleProfileShowUnit"`,
	`sp."showRowNo" AS "styleProfileShowRowNo"`, `sp."fieldSortOrders" AS "styleProfileFieldSortOrders"`,
	`sp."pdfTexts" AS "styleProfilePdfTexts"`, `sp."watermarkFileName" AS "styleProfileWatermarkFileName"`,
	`sp."watermarkFileType" AS "styleProfileWatermarkFileType"`, `sp."watermarkFileSize" AS "styleProfileWatermarkFileSize"`,
	`sp."watermarkFileData" AS "styleProfileWatermarkFileData"`,
	`sp."paidWatermarkFileName" AS "styleProfilePaidWatermarkFileName"`,
	`sp."paidWatermarkFileType" AS "styleProfilePaidWatermarkFileType"`,
	`sp."paidWatermarkFileSize" AS "styleProfilePaidWatermarkFileSize"`,
	`sp."paidWatermarkFileData" AS "styleProfilePaidWatermarkFileData"`,
}

func (r Repo) presets(ctx context.Context, q queryer, where string, args ...any) ([]Row, error) {
	cols, err := tableColumns(ctx, r.DB, "presets")
	if err != nil {
		return nil, err
	}
	sqlText := "SELECT " + plainColumns(cols, "t") + ", " + strings.Join(presetBorrowed, ", ") + presetJoins +
		" " + where + ` ORDER BY t."createdAt" DESC`
	rows, err := q.QueryContext(ctx, sqlText, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := presetReadSpec.scan(rows)
	if err != nil {
		return nil, err
	}
	parse := func(row Row, key string, dropIfEmpty bool) {
		if str, ok := row[key].(string); ok && str != "" {
			if json.Valid([]byte(str)) {
				row[key] = json.RawMessage(str)
				return
			}
		}
		if dropIfEmpty {
			delete(row, key) // undefined in the old server, so the key is absent
		}
	}
	for _, row := range out {
		parse(row, "layoutSchema", true)
		parse(row, "styleProfileFieldSortOrders", false)
		parse(row, "styleProfilePdfTexts", false)
	}
	if out == nil {
		out = []Row{}
	}
	return out, nil
}

// ListPresets returns presets with the data they borrow from their business,
// client, currency, bank and style profile. Only Active/Archived filters apply.
func (r Repo) ListPresets(ctx context.Context, filters []Filter) ([]Row, error) {
	where := ""
	for _, f := range filters {
		switch f.Type {
		case "Active":
			where += ` AND t."isArchived" = 0`
		case "Archived":
			where += ` AND t."isArchived" = 1`
		}
	}
	if where != "" {
		where = "WHERE 1=1" + where
	}
	return r.presets(ctx, r.DB, where)
}

// SavePreset writes one preset in a transaction and returns it as listed. An
// update of an unknown id returns (nil, nil).
func (r Repo) SavePreset(ctx context.Context, row Row, update bool) (Row, error) {
	cols, err := Presets.columns(ctx, r.DB)
	if err != nil {
		return nil, err
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	id, err := Presets.write(ctx, tx, cols, row, update, false)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	got, err := r.presets(ctx, r.DB, `WHERE t."id" = ?`, id)
	if err != nil || len(got) == 0 {
		return nil, err
	}
	return got[0], nil
}

// LayoutByID is the export of one layout (schema parsed), nil when missing.
func (r Repo) LayoutByID(ctx context.Context, id int64) (Row, error) {
	rows, err := Layouts.selectRows(ctx, r.DB, "layouts", `WHERE t."id" = ?`, id)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}
