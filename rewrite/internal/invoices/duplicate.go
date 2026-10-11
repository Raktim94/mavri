package invoices

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// errNoResult is the plain {"success": false} answer.
var errNoResult = errors.New("invoices: no result")

// IsNoResult reports whether err means "answer success:false without a key".
func IsNoResult(err error) bool { return errors.Is(err, errNoResult) }

type origInvoice struct {
	id, businessID, clientID int64
	typ                      string
	number                   sql.NullString
	convertedFrom            sql.NullInt64
}

func (s *Service) duplicateNumber(ctx context.Context, tx *sql.Tx, businessID, clientID int64, origNumber sql.NullString, origType, target string) (string, error) {
	if origType == "quotation" && target == "invoice" {
		if !origNumber.Valid || origNumber.String == "" {
			return "", errNoResult
		}
		parsed, ok := parseNumeric(origNumber.String)
		if !ok {
			return origNumber.String, nil
		}
		var existing int64
		err := tx.QueryRowContext(ctx, `SELECT "id" FROM invoices WHERE "businessId" = ? AND "clientId" = ? AND "invoiceType" = ? AND "invoiceNumber" = ?`,
			businessID, clientID, "invoice", origNumber.String).Scan(&existing)
		exists := err == nil
		if err != nil && err != sql.ErrNoRows {
			return "", err
		}
		seq, err := s.sequenceFor(ctx, tx, businessID, clientID, "invoice")
		if err != nil {
			return "", err
		}
		number := parsed.value
		if exists {
			base := int64(1)
			if seq != nil {
				base = seq.next
			}
			number = base
			if parsed.value+1 > number {
				number = parsed.value + 1
			}
		}
		next := number + 1
		if seq != nil {
			if seq.next < next {
				if err := s.writeSequence(ctx, tx, Row{"id": seq.id, "businessId": businessID, "clientId": clientID,
					"nextSequence": next, "invoiceType": "invoice"}, true); err != nil {
					return "", errNoResult
				}
			}
		} else if err := s.writeSequence(ctx, tx, Row{"businessId": businessID, "clientId": clientID, "nextSequence": next, "invoiceType": "invoice"}, false); err != nil {
			return "", errNoResult
		}
		if !exists {
			return origNumber.String, nil
		}
		width := parsed.width
		if seq != nil {
			_, w, err := scopeStats(ctx, tx, businessID, clientID, "invoice")
			if err != nil {
				return "", err
			}
			if w > width {
				width = w
			}
		}
		return formatWidth(number, width), nil
	}

	seq, err := s.sequenceFor(ctx, tx, businessID, clientID, origType)
	if err != nil {
		return "", err
	}
	if seq != nil {
		_, maxWidth, err := scopeStats(ctx, tx, businessID, clientID, origType)
		if err != nil {
			return "", err
		}
		if err := s.writeSequence(ctx, tx, Row{"id": seq.id, "businessId": seq.businessID, "clientId": seq.clientID,
			"nextSequence": seq.next + 1, "invoiceType": seq.typ}, true); err != nil {
			return "", errNoResult
		}
		return formatWidth(seq.next, maxWidth), nil
	}
	next, padding, err := s.scopedNext(ctx, tx, businessID, clientID, origNumber.String, origType)
	if err != nil {
		return "", err
	}
	if err := s.writeSequence(ctx, tx, Row{"businessId": businessID, "clientId": clientID, "nextSequence": next + 1, "invoiceType": origType}, false); err != nil {
		return "", errNoResult
	}
	return formatWidth(next, padding), nil
}

// Duplicate copies an invoice or quotation into a new one of the given type.
// Turning a quotation into an invoice closes the quotation, keeps its number
// when free, and answers with the (now closed) quotation.
func (s *Service) Duplicate(ctx context.Context, invoiceID int64, target string) (any, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var o origInvoice
	err = tx.QueryRowContext(ctx, `SELECT "id","businessId","clientId","invoiceType","invoiceNumber","convertedFromQuotationId" FROM invoices WHERE "id" = ?`,
		invoiceID).Scan(&o.id, &o.businessID, &o.clientID, &o.typ, &o.number, &o.convertedFrom)
	if err == sql.ErrNoRows {
		return nil, errNoResult
	}
	if err != nil {
		return nil, err
	}
	conversion := o.typ == "quotation" && target == "invoice"
	var convertedFrom any
	if o.convertedFrom.Valid {
		convertedFrom = o.convertedFrom.Int64
	}
	if conversion {
		convertedFrom = o.id
		if _, err := tx.ExecContext(ctx, `UPDATE invoices SET "status" = 'closed' WHERE "id" = ?`, o.id); err != nil {
			return nil, err
		}
	}
	number, err := s.duplicateNumber(ctx, tx, o.businessID, o.clientID, o.number, o.typ, target)
	if err != nil {
		return nil, err
	}
	res, err := tx.ExecContext(ctx, `
        INSERT INTO invoices (
          "invoiceType", "convertedFromQuotationId", "businessId", "clientId", "currencyId",
          "issuedAt", "dueDate", "invoiceNumber", "isArchived", "status", "customerNotes",
          "thanksNotes", "termsConditionNotes", "discountName", "language",
          "discountType", "discountAmountCents", "discountPercent", "shippingFeeCents",
          "invoicePrefix", "invoiceSuffix", "taxName", "taxRate", "taxType", "signatureData",
          "signatureSize", "signatureType", "signatureName", "styleProfilesId", "bankId",
          "surchargeName", "surchargeAmountCents", "surchargePercent", "surchargeType", "layoutId"
        )
        SELECT
          ?, ?, "businessId", "clientId", "currencyId",
          (datetime('now')),
          CASE
            WHEN "dueDate" IS NULL THEN NULL
            ELSE date('now','start of month','+2 months','-1 day')
            END, ?, 0, ?, "customerNotes",
          "thanksNotes", "termsConditionNotes", "discountName", "language",
          "discountType", "discountAmountCents", "discountPercent", "shippingFeeCents",
          "invoicePrefix", "invoiceSuffix", "taxName", "taxRate", "taxType", "signatureData",
          "signatureSize", "signatureType", "signatureName", "styleProfilesId", "bankId",
          "surchargeName", "surchargeAmountCents", "surchargePercent", "surchargeType", "layoutId"
        FROM invoices WHERE "id" = ?`, target, convertedFrom, number, "unpaid", invoiceID)
	if err != nil {
		return nil, err
	}
	newID, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	copyRows := func(table string, columns ...string) error {
		list := `"` + strings.Join(columns, `", "`) + `"`
		_, err := tx.ExecContext(ctx, `INSERT INTO `+table+` ("parentInvoiceId", `+list+`) SELECT ?, `+list+` FROM `+table+` WHERE "parentInvoiceId" = ?`, newID, invoiceID)
		return err
	}
	for _, c := range []struct {
		table string
		cols  []string
	}{
		{"invoice_bank_snapshots", []string{"name", "bankName", "accountNumber", "swiftCode", "address", "branchCode", "type",
			"routingNumber", "accountHolder", "sortOrder", "upiCode", "qrCode", "qrCodeFileSize", "qrCodeFileType", "qrCodeFileName"}},
		{"invoice_business_snapshots", []string{"businessName", "businessShortName", "businessAddress", "businessRole",
			"businessEmail", "businessPhone", "businessAdditional", "businessVatCode", "businessPeppolEndpointId",
			"businessCountryCode", "businessCode", "businessPeppolEndpointSchemeId", "businessLogo", "businessFileSize",
			"businessFileType", "businessFileName"}},
		{"invoice_client_snapshots", []string{"clientName", "clientAddress", "clientEmail", "clientPhone", "clientCode",
			"clientVatCode", "clientPeppolEndpointId", "clientCountryCode", "clientPeppolEndpointSchemeId",
			"clientBuyerReference", "clientAdditional", "clientTaxExempt", "clientTaxExemptionCertificate"}},
		{"invoice_currency_snapshots", []string{"currencyCode", "currencySymbol", "currencySubunit"}},
		{"invoice_customizations", []string{"color", "logoSize", "fontSize", "fontFamily", "tableHeaderStyle", "tableRowStyle",
			"pageFormat", "labelUpperCase", "watermarkFileName", "watermarkFileType", "watermarkFileSize", "watermarkFileData",
			"paidWatermarkFileName", "paidWatermarkFileType", "paidWatermarkFileSize", "paidWatermarkFileData",
			"showQuantity", "showUnit", "showRowNo", "fieldSortOrders", "pdfTexts"}},
		{"invoice_style_profile_snapshots", []string{"styleProfileName"}},
		{"invoice_layout_snapshots", []string{"layoutSchema"}},
	} {
		if err := copyRows(c.table, c.cols...); err != nil {
			return nil, err
		}
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO invoice_items ("parentInvoiceId", "itemId", "quantity", "taxRate", "taxType", "customField")
       SELECT ?, "itemId", "quantity", "taxRate", "taxType", "customField"
       FROM invoice_items WHERE "parentInvoiceId" = ?`, newID, invoiceID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO invoice_item_snapshots (
        "parentInvoiceItemId", "itemName", "unitPriceCents", "unitName"
      )
      SELECT "newItems"."id", snap."itemName", snap."unitPriceCents", snap."unitName"
      FROM invoice_item_snapshots AS snap
      JOIN invoice_items AS "oldItems" ON snap."parentInvoiceItemId" = "oldItems"."id"
      JOIN invoice_items AS "newItems" ON "newItems"."itemId" = "oldItems"."itemId" AND "newItems"."parentInvoiceId" = ?
      WHERE "oldItems"."parentInvoiceId" = ?`, newID, invoiceID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO attachments ("parentInvoiceId", "fileName", "fileType", "fileSize", "data")
       SELECT ?, "fileName", "fileType", "fileSize", "data" FROM attachments WHERE "parentInvoiceId" = ?`, newID, invoiceID); err != nil {
		return nil, err
	}
	show := newID
	if conversion {
		show = o.id
	}
	result, err := s.one(ctx, tx, show)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}
