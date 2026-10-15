// Package model defines the records Mavri stores. Field tags give the SQL
// column (`db`) and the JSON name used by the API (`json`).
package model

import "encoding/json"

// Document kinds and statuses.
const (
	KindInvoice = "invoice"
	KindQuote   = "quote"

	StatusUnpaid   = "unpaid"
	StatusPartial  = "partial"
	StatusPaid     = "paid"
	StatusVoid     = "void"
	StatusOpen     = "open"
	StatusAccepted = "accepted"
	StatusDeclined = "declined"
)

// Party is a company or person: kind "issuer" sends documents, "customer" receives them.
type Party struct {
	ID             int64  `db:"id" json:"id"`
	Kind           string `db:"kind" json:"kind"`
	Name           string `db:"name" json:"name"`
	Email          string `db:"email" json:"email"`
	Phone          string `db:"phone" json:"phone"`
	Address        string `db:"address" json:"address"`
	TaxID          string `db:"tax_id" json:"taxId"`
	Country        string `db:"country" json:"country"`
	EScheme        string `db:"e_scheme" json:"eScheme"`
	EAddress       string `db:"e_address" json:"eAddress"`
	BuyerReference string `db:"buyer_reference" json:"buyerReference"`
	TaxExempt      bool   `db:"tax_exempt" json:"taxExempt"`
	Note           string `db:"note" json:"note"`
	Logo           []byte `db:"logo" json:"logo,omitempty"`
	LogoType       string `db:"logo_type" json:"logoType"`
	Archived       bool   `db:"archived" json:"archived"`
	CreatedAt      string `db:"created_at" json:"createdAt"`
	UpdatedAt      string `db:"updated_at" json:"updatedAt"`
}

// Currency describes how amounts in one currency are shown.
type Currency struct {
	ID       int64  `db:"id" json:"id"`
	Code     string `db:"code" json:"code"`
	Symbol   string `db:"symbol" json:"symbol"`
	Name     string `db:"name" json:"name"`
	Pattern  string `db:"pattern" json:"pattern"`
	Decimals int    `db:"decimals" json:"decimals"`
	Archived bool   `db:"archived" json:"archived"`
}

// BankAccount holds payment details printed on documents.
type BankAccount struct {
	ID            int64  `db:"id" json:"id"`
	Label         string `db:"label" json:"label"`
	BankName      string `db:"bank_name" json:"bankName"`
	Holder        string `db:"holder" json:"holder"`
	AccountNumber string `db:"account_number" json:"accountNumber"`
	Swift         string `db:"swift" json:"swift"`
	Routing       string `db:"routing" json:"routing"`
	Branch        string `db:"branch" json:"branch"`
	Address       string `db:"address" json:"address"`
	UPI           string `db:"upi" json:"upi"`
	QRImage       []byte `db:"qr_image" json:"qrImage,omitempty"`
	QRType        string `db:"qr_type" json:"qrType"`
	Archived      bool   `db:"archived" json:"archived"`
}

// Group is a product category or unit of measure.
type Group struct {
	ID       int64  `db:"id" json:"id"`
	Kind     string `db:"kind" json:"kind"`
	Name     string `db:"name" json:"name"`
	Archived bool   `db:"archived" json:"archived"`
}

// Product is a catalog entry. PriceCents is in hundredths of the unit of any currency.
type Product struct {
	ID          int64  `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Description string `db:"description" json:"description"`
	PriceCents  int64  `db:"price_cents" json:"priceCents"`
	CategoryID  *int64 `db:"category_id" json:"categoryId"`
	UnitID      *int64 `db:"unit_id" json:"unitId"`
	Archived    bool   `db:"archived" json:"archived"`
}

// Style is a saved look for documents.
type Style struct {
	ID          int64  `db:"id" json:"id"`
	Name        string `db:"name" json:"name"`
	Accent      string `db:"accent" json:"accent"`
	Font        string `db:"font" json:"font"`
	TextSize    string `db:"text_size" json:"textSize"`
	LogoSize    string `db:"logo_size" json:"logoSize"`
	PageSize    string `db:"page_size" json:"pageSize"`
	HeaderStyle string `db:"header_style" json:"headerStyle"`
	RowStyle    string `db:"row_style" json:"rowStyle"`
	UpperLabels bool   `db:"upper_labels" json:"upperLabels"`
	ShowNumbers bool   `db:"show_numbers" json:"showNumbers"`
	ShowUnit    bool   `db:"show_unit" json:"showUnit"`
	ShowQty     bool   `db:"show_qty" json:"showQty"`
	Archived    bool   `db:"archived" json:"archived"`
}

// Preset is a saved starting point for new documents.
type Preset struct {
	ID           int64  `db:"id" json:"id"`
	Name         string `db:"name" json:"name"`
	IssuerID     int64  `db:"issuer_id" json:"issuerId"`
	CustomerID   int64  `db:"customer_id" json:"customerId"`
	CurrencyID   int64  `db:"currency_id" json:"currencyId"`
	BankID       *int64 `db:"bank_id" json:"bankId"`
	StyleID      *int64 `db:"style_id" json:"styleId"`
	NoteCustomer string `db:"note_customer" json:"noteCustomer"`
	NoteTerms    string `db:"note_terms" json:"noteTerms"`
	NoteThanks   string `db:"note_thanks" json:"noteThanks"`
	Archived     bool   `db:"archived" json:"archived"`
}

// Adjustment is a discount or surcharge: Mode is "", "fixed" (Cents) or "percent" (Percent).
type Adjustment struct {
	Mode    string  `json:"mode"`
	Cents   int64   `json:"cents"`
	Percent float64 `json:"percent"`
}

// Line is one row of a document. TaxMode is "", "add" (tax on top) or "included".
type Line struct {
	ID        int64   `json:"id,omitempty"`
	ProductID *int64  `json:"productId"`
	Name      string  `json:"name"`
	Unit      string  `json:"unit"`
	Quantity  float64 `json:"quantity"`
	UnitCents int64   `json:"unitCents"`
	TaxRate   float64 `json:"taxRate"`
	TaxMode   string  `json:"taxMode"`
}

// Payment is money received against an invoice.
type Payment struct {
	ID          int64  `db:"id" json:"id,omitempty"`
	DocumentID  int64  `db:"document_id" json:"-"`
	AmountCents int64  `db:"amount_cents" json:"amountCents"`
	PaidOn      string `db:"paid_on" json:"paidOn"`
	Method      string `db:"method" json:"method"`
	Note        string `db:"note" json:"note"`
}

// Attachment is a file kept with a document.
type Attachment struct {
	ID         int64  `db:"id" json:"id,omitempty"`
	DocumentID int64  `db:"document_id" json:"-"`
	Name       string `db:"name" json:"name"`
	MediaType  string `db:"media_type" json:"mediaType"`
	Data       []byte `db:"data" json:"data,omitempty"`
}

// Document is an invoice or a quote with everything that belongs to it.
type Document struct {
	ID            int64      `json:"id"`
	Kind          string     `json:"kind"`
	NumberPrefix  string     `json:"numberPrefix"`
	Number        string     `json:"number"`
	NumberSuffix  string     `json:"numberSuffix"`
	FullNumber    string     `json:"fullNumber"`
	IssuerID      int64      `json:"issuerId"`
	CustomerID    int64      `json:"customerId"`
	CurrencyID    int64      `json:"currencyId"`
	BankID        *int64     `json:"bankId"`
	StyleID       *int64     `json:"styleId"`
	ConvertedFrom *int64     `json:"convertedFrom"`
	IssuedOn      string     `json:"issuedOn"`
	DueOn         string     `json:"dueOn"`
	Status        string     `json:"status"`
	Discount      Adjustment `json:"discount"`
	Surcharge     Adjustment `json:"surcharge"`
	ShippingCents int64      `json:"shippingCents"`
	TaxRate       float64    `json:"taxRate"`
	TaxMode       string     `json:"taxMode"`
	NoteCustomer  string     `json:"noteCustomer"`
	NoteTerms     string     `json:"noteTerms"`
	NoteThanks    string     `json:"noteThanks"`

	// Copies taken when the document was saved.
	Issuer   Party       `json:"issuer"`
	Customer Party       `json:"customer"`
	Currency Currency    `json:"currency"`
	Bank     BankAccount `json:"bank"`
	Style    Style       `json:"style"`

	Lines       []Line       `json:"lines"`
	Payments    []Payment    `json:"payments"`
	Attachments []Attachment `json:"attachments"`

	// Computed, never stored.
	Totals    Totals `json:"totals"`
	PaidCents int64  `json:"paidCents"`

	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// Totals are the amounts of a document in minor units.
type Totals struct {
	SubtotalCents  int64 `json:"subtotalCents"`
	DiscountCents  int64 `json:"discountCents"`
	SurchargeCents int64 `json:"surchargeCents"`
	ShippingCents  int64 `json:"shippingCents"`
	TaxCents       int64 `json:"taxCents"`
	TotalCents     int64 `json:"totalCents"`
}

// Summary is a document as shown in lists.
type Summary struct {
	ID            int64  `json:"id"`
	Kind          string `json:"kind"`
	FullNumber    string `json:"fullNumber"`
	CustomerID    int64  `json:"customerId"`
	CustomerName  string `json:"customerName"`
	IssuedOn      string `json:"issuedOn"`
	DueOn         string `json:"dueOn"`
	Status        string `json:"status"`
	CurrencyCode  string `json:"currencyCode"`
	CurrencySym   string `json:"currencySymbol"`
	CurrencyPat   string `json:"currencyPattern"`
	CurrencyScale int    `json:"currencyDecimals"`
	TotalCents    int64  `json:"totalCents"`
	PaidCents     int64  `json:"paidCents"`
}

// Settings are the app preferences.
type Settings struct {
	InvoicePrefix string   `json:"invoicePrefix"`
	InvoiceSuffix string   `json:"invoiceSuffix"`
	QuotePrefix   string   `json:"quotePrefix"`
	DateFormat    string   `json:"dateFormat"`
	NumberLocale  string   `json:"numberLocale"`
	Features      Features `json:"features"`
}

// Features switch optional parts of the app on or off.
type Features struct {
	Quotes    bool `json:"quotes"`
	Presets   bool `json:"presets"`
	Styles    bool `json:"styles"`
	Reports   bool `json:"reports"`
	UBL       bool `json:"ubl"`
	XRechnung bool `json:"xrechnung"`
}

// DefaultSettings are used until the owner saves their own.
func DefaultSettings() Settings {
	return Settings{DateFormat: "yyyy-MM-dd", NumberLocale: "en-US", QuotePrefix: "Q-",
		Features: Features{true, true, true, true, true, true}}
}

// Shop is a connected online store.
type Shop struct {
	ID          int64   `db:"id" json:"id"`
	Name        string  `db:"name" json:"name"`
	Platform    string  `db:"platform" json:"platform"`
	SecretSeal  string  `db:"secret_sealed" json:"-"`
	IssuerID    int64   `db:"issuer_id" json:"issuerId"`
	CurrencyID  int64   `db:"currency_id" json:"currencyId"`
	BankID      *int64  `db:"bank_id" json:"bankId"`
	StyleID     *int64  `db:"style_id" json:"styleId"`
	DefaultTax  float64 `db:"default_tax" json:"defaultTax"`
	MarkPaid    bool    `db:"mark_paid" json:"markPaid"`
	Active      bool    `db:"active" json:"active"`
	LastEventAt string  `db:"last_event_at" json:"lastEventAt"`
	CreatedBy   *int64  `db:"created_by" json:"-"`
	CreatedAt   string  `db:"created_at" json:"createdAt"`
	WebhookURL  string  `db:"-" json:"webhookUrl"`
}

// RawJSON is stored text that is already JSON.
type RawJSON = json.RawMessage
