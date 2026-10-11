// Package invoices is the invoice service: reading an invoice with everything
// attached to it, saving it with its snapshots, items, payments and
// attachments in one transaction, duplicating it, and numbering.
package invoices

import "github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"

func table(name string, fields, blobs, json []string) *entity.Spec {
	return &entity.Spec{Table: name, Fields: fields, Blobs: blobs, JSONFields: json}
}

// One spec per table. Fields are the columns a request may write.
var (
	invoice = table("invoices", []string{"invoiceType", "convertedFromQuotationId", "businessId", "clientId",
		"currencyId", "issuedAt", "dueDate", "bankId", "invoiceNumber", "paidAt", "closedAt", "isArchived", "status",
		"customerNotes", "thanksNotes", "termsConditionNotes", "discountName", "invoicePrefix", "invoiceSuffix",
		"discountType", "discountAmountCents", "discountPercent", "shippingFeeCents", "surchargeName",
		"surchargeAmountCents", "surchargeType", "surchargePercent", "taxName", "taxRate", "taxType", "language",
		"signatureData", "signatureSize", "signatureType", "signatureName", "styleProfilesId", "layoutId"},
		[]string{"signatureData"}, nil)

	currencySnap = table("invoice_currency_snapshots",
		[]string{"parentInvoiceId", "currencyCode", "currencySymbol", "currencySubunit"}, nil, nil)

	clientSnap = table("invoice_client_snapshots", []string{"parentInvoiceId", "clientName", "clientAddress",
		"clientEmail", "clientPhone", "clientCode", "clientAdditional", "clientVatCode", "clientPeppolEndpointId",
		"clientCountryCode", "clientPeppolEndpointSchemeId", "clientBuyerReference", "clientTaxExempt",
		"clientTaxExemptionCertificate"}, nil, nil)

	bankSnap = table("invoice_bank_snapshots", []string{"parentInvoiceId", "name", "bankName", "accountNumber",
		"swiftCode", "address", "branchCode", "type", "routingNumber", "accountHolder", "sortOrder", "upiCode",
		"qrCode", "qrCodeFileSize", "qrCodeFileType", "qrCodeFileName"}, []string{"qrCode"}, nil)

	businessSnap = table("invoice_business_snapshots", []string{"parentInvoiceId", "businessName", "businessAddress",
		"businessRole", "businessShortName", "businessEmail", "businessPhone", "businessAdditional", "businessVatCode",
		"businessPeppolEndpointId", "businessCountryCode", "businessCode", "businessPeppolEndpointSchemeId",
		"businessLogo", "businessFileSize", "businessFileType", "businessFileName"}, []string{"businessLogo"}, nil)

	styleSnap = table("invoice_style_profile_snapshots", []string{"parentInvoiceId", "styleProfileName"}, nil, nil)

	customization = table("invoice_customizations", []string{"parentInvoiceId", "color", "logoSize", "fontSize",
		"fontFamily", "tableHeaderStyle", "tableRowStyle", "pageFormat", "labelUpperCase", "watermarkFileName",
		"watermarkFileType", "watermarkFileSize", "watermarkFileData", "paidWatermarkFileName", "paidWatermarkFileType",
		"paidWatermarkFileSize", "paidWatermarkFileData", "showQuantity", "showUnit", "showRowNo", "fieldSortOrders",
		"pdfTexts"}, []string{"watermarkFileData", "paidWatermarkFileData"}, []string{"fieldSortOrders", "pdfTexts"})

	layoutSnap = table("invoice_layout_snapshots", []string{"parentInvoiceId", "layoutSchema"}, nil, []string{"layoutSchema"})

	itemSnap = table("invoice_item_snapshots", []string{"parentInvoiceItemId", "itemName", "unitPriceCents", "unitName"}, nil, nil)
	payment  = table("invoice_payments", []string{"parentInvoiceId", "amountCents", "paidAt", "paymentMethod", "notes"}, nil, nil)
	lineItem = table("invoice_items", []string{"parentInvoiceId", "itemId", "quantity", "taxRate", "taxType", "customField"},
		nil, []string{"customField"})
	attachment = table("attachments", []string{"parentInvoiceId", "fileSize", "fileType", "fileName", "data"}, []string{"data"}, nil)
	sequence   = table("invoice_sequences", []string{"nextSequence", "clientId", "businessId", "invoiceType"}, nil, nil)
)

// RequestShape tells the decoder where the JSON columns sit in an invoice
// request body.
var RequestShape = entity.Tree{
	Children: map[string]entity.Tree{
		"invoiceCustomization":        {JSON: []string{"fieldSortOrders", "pdfTexts"}},
		"invoiceLayoutSnapshot":       {JSON: []string{"layoutSchema"}},
		"invoiceStyleProfileSnapshot": {}, "invoiceCurrencySnapshot": {}, "invoiceBankSnapshot": {},
		"invoiceBusinessSnapshot": {}, "invoiceClientSnapshot": {},
	},
	Lists: map[string]entity.Tree{
		"invoiceItems":    {JSON: []string{"customField"}, Children: map[string]entity.Tree{"invoiceItemSnapshot": {}}},
		"invoicePayments": {}, "invoiceAttachments": {},
	},
}
