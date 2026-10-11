package entity

import (
	"context"
	"database/sql"
	"encoding/json"
)

const (
	invoiceDirect = `COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice' THEN i."id" END)`
	quotesDirect  = `COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation' THEN i."id" END)`
	invoiceViaItm = `COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice' THEN ii."parentInvoiceId" END)`
	quotesViaItm  = `COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation' THEN ii."parentInvoiceId" END)`
)

func direct(table string, fields, blobs []string, fk string) *Spec {
	return &Spec{
		Table: table, Fields: fields, Blobs: blobs,
		Joins:    `LEFT JOIN invoices i ON i."` + fk + `" = t."id"`,
		InvAlias: "i", InvoiceCount: invoiceDirect, QuotesCount: quotesDirect,
	}
}

func viaItems(table string, fk string, fields []string) *Spec {
	return &Spec{
		Table: table, Fields: fields,
		Joins: `LEFT JOIN items it ON it."` + fk + `" = t."id"
LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"`,
		InvAlias: "inv", InvoiceCount: invoiceViaItm, QuotesCount: quotesViaItm,
	}
}

// Banks, Businesses, Clients, Currencies, Categories, Units and Items are the
// simple resources. Field lists are the columns the renderer may write.
var (
	Banks = direct("banks", []string{"name", "bankName", "accountNumber", "swiftCode", "address", "branchCode", "type",
		"routingNumber", "accountHolder", "sortOrder", "upiCode", "qrCode", "qrCodeFileSize", "qrCodeFileType",
		"qrCodeFileName", "isArchived"}, []string{"qrCode"}, "bankId")

	Businesses = direct("businesses", []string{"name", "shortName", "address", "role", "email", "phone", "website",
		"additional", "logo", "fileSize", "fileType", "fileName", "description", "vatCode", "peppolEndpointId",
		"countryCode", "code", "peppolEndpointSchemeId", "isArchived"}, []string{"logo"}, "businessId")

	Clients = func() *Spec {
		s := direct("clients", []string{"name", "shortName", "address", "email", "phone", "code", "additional",
			"description", "vatCode", "peppolEndpointId", "countryCode", "peppolEndpointSchemeId", "buyerReference",
			"taxExempt", "taxExemptionCertificate", "isArchived"}, nil, "clientId")
		s.Defaults = map[string]any{"taxExempt": false}
		return s
	}()

	Currencies = direct("currencies", []string{"code", "symbol", "text", "format", "isArchived", "subunit"}, nil, "currencyId")
	Categories = viaItems("categories", "categoryId", []string{"name", "isArchived"})
	Units      = viaItems("units", "unitId", []string{"name", "isArchived"})

	Items = &Spec{
		Table:  "items",
		Fields: []string{"name", "amount", "unitId", "categoryId", "description", "isArchived"},
		Joins: `LEFT JOIN units u ON t."unitId" = u."id"
LEFT JOIN categories c ON t."categoryId" = c."id"
LEFT JOIN invoice_items ii ON ii."itemId" = t."id"
LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"`,
		InvAlias: "inv", InvoiceCount: invoiceViaItm, QuotesCount: quotesViaItm,
		Extra:   `u."name" AS "unitName", c."name" AS "categoryName"`,
		GroupBy: `t."id", u."name", c."name"`,
		Prepare: resolveItemRelations,
	}
)

// resolveItemRelations lets an imported item name its unit and category
// instead of giving ids; missing ones are created.
func resolveItemRelations(ctx context.Context, tx *sql.Tx, row Row) error {
	for _, r := range []struct{ idKey, nameKey, table string }{
		{"categoryId", "categoryName", "categories"},
		{"unitId", "unitName", "units"},
	} {
		name, _ := row[r.nameKey].(string)
		if _, has := row[r.idKey]; has || name == "" {
			continue
		}
		var id int64
		err := tx.QueryRowContext(ctx, `SELECT "id" FROM `+r.table+` WHERE "name" = ? LIMIT 1`, name).Scan(&id)
		if err == sql.ErrNoRows {
			res, err := tx.ExecContext(ctx, `INSERT INTO `+r.table+` ("name") VALUES (?)`, name)
			if err != nil {
				return err
			}
			if id, err = res.LastInsertId(); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		row[r.idKey] = json.Number(itoa(id))
	}
	return nil
}

func itoa(i int64) string { return json.Number(formatInt(i)).String() }

// StyleProfiles carry two JSON columns and, on lists, the schema of the
// layout they point at.
var StyleProfiles = func() *Spec {
	s := direct("style_profiles", []string{"name", "color", "logoSize", "fontSize", "fontFamily", "layoutId",
		"tableHeaderStyle", "tableRowStyle", "pageFormat", "labelUpperCase", "watermarkFileName", "watermarkFileType",
		"watermarkFileSize", "watermarkFileData", "paidWatermarkFileName", "paidWatermarkFileType",
		"paidWatermarkFileSize", "paidWatermarkFileData", "isArchived", "showQuantity", "showUnit", "showRowNo",
		"fieldSortOrders", "pdfTexts"}, []string{"watermarkFileData", "paidWatermarkFileData"}, "styleProfilesId")
	s.JSONFields = []string{"fieldSortOrders", "pdfTexts"}
	s.AfterList = func(ctx context.Context, db *sql.DB, rows []Row) error {
		res, err := db.QueryContext(ctx, `SELECT "id", "schema" FROM layouts`)
		if err != nil {
			return err
		}
		defer res.Close()
		schemas := map[int64]json.RawMessage{}
		for res.Next() {
			var id int64
			var schema string
			if err := res.Scan(&id, &schema); err != nil {
				return err
			}
			if json.Valid([]byte(schema)) {
				schemas[id] = json.RawMessage(schema)
			}
		}
		if err := res.Err(); err != nil {
			return err
		}
		for _, row := range rows {
			if id, ok := row["layoutId"].(int64); ok {
				if sc, found := schemas[id]; found {
					row["layoutSchema"] = sc
				}
			}
		}
		return nil
	}
	return s
}()

// Layouts hold their definition as JSON text.
var Layouts = func() *Spec {
	s := direct("layouts", []string{"isArchived", "schema"}, nil, "layoutId")
	s.JSONFields = []string{"schema"}
	return s
}()

// Presets are written through this spec (batch import); reading them uses the
// joined query in presets.go.
var Presets = &Spec{
	Table: "presets",
	Fields: []string{"name", "businessId", "clientId", "currencyId", "bankId", "styleProfilesId", "customerNotes",
		"thanksNotes", "termsConditionNotes", "language", "signatureData", "signatureSize", "signatureType",
		"signatureName", "isArchived"},
	Blobs: []string{"signatureData"},
}
