// Package irp writes an invoice as the JSON the Indian e-invoice system (the Invoice Registration Portal, IRP)
// accepts for upload: schema version 1.1, B2B supplies within India.
//
// This only prepares the file. Mavri does not talk to the IRP, so it cannot register the invoice, obtain an IRN
// or the signed QR code, and a file made here has not been checked by the IRP. Upload it through the portal's
// bulk tool or hand it to your GST Suvidha Provider. The IRP is the authority on what is valid.
package irp

import (
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/taxpack"
)

// Problems lists what stops a document from becoming an IRP file.
type Problems []string

func (p Problems) Error() string { return strings.Join(p, "; ") }

type tranDtls struct {
	TaxSch      string `json:"TaxSch"`
	SupTyp      string `json:"SupTyp"`
	RegRev      string `json:"RegRev"`
	IgstOnIntra string `json:"IgstOnIntra"`
}
type docDtls struct {
	Typ string `json:"Typ"`
	No  string `json:"No"`
	Dt  string `json:"Dt"`
}
type party struct {
	Gstin string `json:"Gstin"`
	LglNm string `json:"LglNm"`
	Pos   string `json:"Pos,omitempty"`
	Addr1 string `json:"Addr1"`
	Addr2 string `json:"Addr2,omitempty"`
	Loc   string `json:"Loc"`
	Pin   int    `json:"Pin"`
	Stcd  string `json:"Stcd"`
	Ph    string `json:"Ph,omitempty"`
	Em    string `json:"Em,omitempty"`
}
type item struct {
	SlNo       string  `json:"SlNo"`
	PrdDesc    string  `json:"PrdDesc"`
	IsServc    string  `json:"IsServc"`
	HsnCd      string  `json:"HsnCd"`
	Qty        float64 `json:"Qty"`
	Unit       string  `json:"Unit"`
	UnitPrice  float64 `json:"UnitPrice"`
	TotAmt     float64 `json:"TotAmt"`
	Discount   float64 `json:"Discount"`
	AssAmt     float64 `json:"AssAmt"`
	GstRt      float64 `json:"GstRt"`
	IgstAmt    float64 `json:"IgstAmt"`
	CgstAmt    float64 `json:"CgstAmt"`
	SgstAmt    float64 `json:"SgstAmt"`
	CesRt      float64 `json:"CesRt"`
	CesAmt     float64 `json:"CesAmt"`
	TotItemVal float64 `json:"TotItemVal"`
}
type valDtls struct {
	AssVal    float64 `json:"AssVal"`
	CgstVal   float64 `json:"CgstVal"`
	SgstVal   float64 `json:"SgstVal"`
	IgstVal   float64 `json:"IgstVal"`
	CesVal    float64 `json:"CesVal"`
	Discount  float64 `json:"Discount"`
	OthChrg   float64 `json:"OthChrg"`
	RndOffAmt float64 `json:"RndOffAmt"`
	TotInvVal float64 `json:"TotInvVal"`
}
type precDoc struct {
	InvNo string `json:"InvNo"`
	InvDt string `json:"InvDt"`
}
type invoice struct {
	Version     string    `json:"Version"`
	TranDtls    tranDtls  `json:"TranDtls"`
	DocDtls     docDtls   `json:"DocDtls"`
	SellerDtls  party     `json:"SellerDtls"`
	BuyerDtls   party     `json:"BuyerDtls"`
	ItemList    []item    `json:"ItemList"`
	ValDtls     valDtls   `json:"ValDtls"`
	PrecDocDtls []precDoc `json:"PrecDocDtls,omitempty"`
	PayDtls     *payDtls  `json:"PayDtls,omitempty"`
}
type payDtls struct {
	Nm       string `json:"Nm,omitempty"`
	Accdet   string `json:"AccDet,omitempty"`
	Mode     string `json:"Mode,omitempty"`
	Fininsbr string `json:"FinInsBr,omitempty"`
}

var pinRE = regexp.MustCompile(`\b([1-9][0-9]{5})\b`)

// uqc maps common unit names to the IRP's unit quantity codes; anything else is OTH (others).
var uqc = map[string]string{
	"pc": "PCS", "pcs": "PCS", "piece": "PCS", "pieces": "PCS", "nos": "NOS", "no": "NOS", "number": "NOS", "unit": "UNT", "units": "UNT",
	"kg": "KGS", "kgs": "KGS", "kilogram": "KGS", "g": "GMS", "gm": "GMS", "gram": "GMS", "l": "LTR", "ltr": "LTR", "litre": "LTR", "liter": "LTR",
	"m": "MTR", "mtr": "MTR", "metre": "MTR", "meter": "MTR", "box": "BOX", "boxes": "BOX", "pack": "PAC", "set": "SET", "dozen": "DOZ", "pair": "PRS",
	"sqm": "SQM", "sqft": "SQF", "ton": "TON", "tonne": "TON", "bag": "BAG", "bottle": "BTL", "roll": "ROL",
}

func rupees(c int64) float64 { return float64(c) / 100 }

func r2(f float64) float64 { return math.Round(f*100) / 100 }

// Generate builds the IRP JSON for an issued invoice, credit note or debit note, or returns Problems.
func Generate(d model.Document) ([]byte, error) {
	var p Problems
	bad := func(f string, a ...any) { p = append(p, fmt.Sprintf(f, a...)) }
	if d.Kind != model.KindInvoice {
		return nil, Problems{"only invoices, credit notes and debit notes go to the e-invoice system"}
	}
	if d.Status == model.StatusDraft {
		bad("issue the invoice first")
	}
	if d.Currency.Code != "INR" {
		bad("the e-invoice system takes rupee invoices; this one is in %s", d.Currency.Code)
	}
	if d.TaxRate > 0 && d.TaxMode != "" {
		bad("document-level tax is not supported here; put the tax on each line")
	}
	typ := map[string]string{"": "INV", "credit": "CRN", "debit": "DBN"}[d.DocType]
	seller, buyer := d.Issuer, d.Customer
	sg, bg := strings.ToUpper(strings.ReplaceAll(seller.TaxID, " ", "")), strings.ToUpper(strings.ReplaceAll(buyer.TaxID, " ", ""))
	if !taxpack.CheckID("IN", sg).Valid {
		bad("your GSTIN is missing or not valid (%s)", seller.TaxID)
	}
	if !taxpack.CheckID("IN", bg).Valid {
		bad("the customer's GSTIN is missing or not valid (%s): only business-to-business supplies are covered", buyer.TaxID)
	}
	build := func(who string, pr model.Party, gstin string) party {
		pt := party{Gstin: gstin, LglNm: pr.Name, Ph: digits(pr.Phone), Em: pr.Email}
		if len(gstin) >= 2 {
			pt.Stcd = gstin[:2]
		}
		lines := nonEmpty(strings.Split(pr.Address, "\n"))
		if len(lines) == 0 {
			bad("%s has no address", who)
			return pt
		}
		pt.Addr1 = trunc(lines[0], 100)
		if len(lines) > 2 {
			pt.Addr2 = trunc(strings.Join(lines[1:len(lines)-1], ", "), 100)
		}
		last := lines[len(lines)-1]
		if m := pinRE.FindString(last); m != "" {
			fmt.Sscanf(m, "%d", &pt.Pin)
			pt.Loc = strings.TrimSpace(strings.Trim(strings.Replace(last, m, "", 1), " ,-"))
		} else if m := pinRE.FindString(pr.Address); m != "" {
			fmt.Sscanf(m, "%d", &pt.Pin)
			pt.Loc = strings.TrimSpace(strings.Trim(last, " ,-"))
		} else {
			bad("%s: the address needs a 6-digit PIN code (put it with the city on the last line)", who)
		}
		if pt.Loc == "" {
			bad("%s: the last address line needs the city or town", who)
		}
		if len(pt.Loc) > 50 {
			pt.Loc = pt.Loc[:50]
		}
		return pt
	}
	sd := build("your business", seller, sg)
	bd := build("the customer", buyer, bg)
	bd.Pos = bd.Stcd
	intra := sd.Stcd != "" && sd.Stcd == bd.Stcd
	issued, err := time.Parse("2006-01-02", d.IssuedOn)
	if err != nil {
		bad("the invoice date is not a date")
	}

	// Surcharge and shipping go in "other charges". A document-level discount cannot be expressed faithfully: Mavri
	// charges tax on the lines before the discount, while the e-invoice system taxes the value after it, so the
	// two would disagree. The discount has to be put into the line prices instead.
	t := d.Totals
	if t.DiscountCents > 0 {
		bad("a document-level discount cannot be sent: put the discount into the line prices instead, because the e-invoice system taxes the discounted value")
	}
	var items []item
	var sumNet int64
	nets := make([]int64, len(d.Lines))
	for i, l := range d.Lines {
		g := money.Gross(l)
		net := g
		if l.TaxMode == "included" && l.TaxRate > 0 {
			n, _ := money.LineTax(l)
			net = n
		}
		nets[i] = net
		sumNet += net
	}
	discounts := make([]int64, len(nets))
	_ = sumNet
	var cgstT, sgstT, igstT, assT, totItems int64
	for i, l := range d.Lines {
		if strings.TrimSpace(l.TaxCode) == "" {
			bad("line %d (%s) needs an HSN or SAC code", i+1, l.Name)
		}
		if l.TaxMode != "" && l.TaxMode != "add" && l.TaxMode != "included" {
			bad("line %d: unsupported tax mode", i+1)
		}
		rate := l.TaxRate
		if l.TaxMode == "" {
			rate = 0
		}
		ass := nets[i] - discounts[i]
		tax := int64(math.Round(float64(ass) * rate / 100))
		var cg, sg2, ig int64
		if intra {
			cg = tax / 2
			sg2 = tax - cg
		} else {
			ig = tax
		}
		unit := uqc[strings.ToLower(strings.TrimSpace(l.Unit))]
		if unit == "" {
			unit = "OTH"
		}
		servc := "N"
		if l.LineType == "service" || l.LineType == "time" || strings.HasPrefix(strings.TrimSpace(l.TaxCode), "99") {
			servc = "Y"
		}
		it := item{SlNo: fmt.Sprint(i + 1), PrdDesc: trunc(l.Name, 300), IsServc: servc, HsnCd: strings.TrimSpace(l.TaxCode), Qty: l.Quantity, Unit: unit,
			UnitPrice: rupees(l.UnitCents), TotAmt: rupees(nets[i]), Discount: rupees(discounts[i]), AssAmt: rupees(ass), GstRt: rate,
			IgstAmt: rupees(ig), CgstAmt: rupees(cg), SgstAmt: rupees(sg2), TotItemVal: rupees(ass + tax)}
		items = append(items, it)
		cgstT, sgstT, igstT, assT, totItems = cgstT+cg, sgstT+sg2, igstT+ig, assT+ass, totItems+ass+tax
	}
	oth := t.SurchargeCents + t.ShippingCents
	total := totItems + oth
	val := valDtls{AssVal: rupees(assT), CgstVal: rupees(cgstT), SgstVal: rupees(sgstT), IgstVal: rupees(igstT), Discount: 0, OthChrg: rupees(oth),
		RndOffAmt: rupees(t.TotalCents - total), TotInvVal: rupees(t.TotalCents)}
	if diff := t.TotalCents - total; diff > 100 || diff < -100 {
		bad("the lines do not add up to the invoice total (difference %s); check discounts and tax that is included in prices", money.Major(diff, 2))
	}
	if len(p) > 0 {
		return nil, p
	}
	inv := invoice{Version: "1.1", TranDtls: tranDtls{TaxSch: "GST", SupTyp: "B2B", RegRev: "N", IgstOnIntra: "N"},
		DocDtls: docDtls{Typ: typ, No: d.FullNumber, Dt: issued.Format("02/01/2006")}, SellerDtls: sd, BuyerDtls: bd, ItemList: items, ValDtls: val}
	if d.DocType != "" && d.CorrectsNumber != "" {
		inv.PrecDocDtls = []precDoc{{InvNo: d.CorrectsNumber, InvDt: issued.Format("02/01/2006")}}
	}
	if d.Bank.AccountNumber != "" {
		inv.PayDtls = &payDtls{Nm: d.Bank.Holder, Accdet: d.Bank.AccountNumber, Mode: "Credit Transfer", Fininsbr: d.Bank.Swift}
	}
	if len(d.Lines) > 1000 {
		return nil, Problems{"the e-invoice system takes at most 1000 lines"}
	}
	return json.MarshalIndent([]invoice{inv}, "", "  ")
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func nonEmpty(in []string) []string {
	var out []string
	for _, s := range in {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func trunc(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}
