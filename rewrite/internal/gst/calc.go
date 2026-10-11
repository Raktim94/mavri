package gst

import (
	"errors"
	"math/big"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// SupplierKind is the supplier's registration scheme.
type SupplierKind string

const (
	RegularSupplier     SupplierKind = "regular"
	CompositionSupplier SupplierKind = "composition"
	Unregistered        SupplierKind = "unregistered"
)

// SupplyKind is chosen by the user. Export and SEZ supplies are charged IGST
// even when supplier and place of supply share a state; Mavri does not decide
// whether a supply qualifies, the user states it.
type SupplyKind string

const (
	DomesticSupply SupplyKind = "domestic"
	ExportSupply   SupplyKind = "export"
	SEZSupply      SupplyKind = "sez"
)

// Document types.
const (
	TaxInvoice   = "tax_invoice"
	BillOfSupply = "bill_of_supply"
)

// Errors (translation keys).
var (
	ErrUnknownState  = errors.New("error.gst.unknownState")
	ErrNegativeValue = errors.New("error.gst.negativeTaxableValue")
	ErrNoLines       = errors.New("error.gst.noLines")
)

// LineInput is one supply. Amounts are in minor units (paise).
type LineInput struct {
	Code     string // HSN or SAC
	Gross    *money.Rat
	Discount *money.Rat // pre-supply discount allocated to this line, may be nil
}

// Input is everything the calculation depends on.
type Input struct {
	Date          time.Time // issue date; selects which rules apply
	SupplierState string
	SupplierKind  SupplierKind
	PlaceOfSupply string
	SupplyKind    SupplyKind
	ReverseCharge bool
	Rules         RuleBook
	Lines         []LineInput
}

// LineResult is the outcome for one line; amounts are whole paise.
type LineResult struct {
	Code                   string // HSN or SAC the line was taxed under
	Taxable                *big.Int
	Class                  Class
	RuleID                 string
	Rate, CessRate         *money.Rat
	CGST, SGST, IGST, Cess *big.Int
}

// Result is a complete calculation. Persist it with the invoice as its GST
// snapshot so later changes to rules or the business profile never alter an
// issued invoice.
type Result struct {
	DocType            string
	IntraState         bool
	StateTaxName       string // "SGST" or "UTGST" (the SGST fields hold this tax)
	Lines              []LineResult
	TaxableTotal       *big.Int
	CGST, SGST, IGST   *big.Int
	Cess, TaxTotal     *big.Int
	TaxCollected       *big.Int // zero under reverse charge or on a bill of supply
	PayableByRecipient *big.Int // tax the recipient pays directly (reverse charge)
	InvoiceTotal       *big.Int // taxable value + tax collected
	Notes              []Note
	NeedsReview        bool
}

func newInt() *big.Int { return new(big.Int) }

// Calculate computes GST for the supplied lines. Each line's taxable value is
// rounded to whole paise (half up) and each tax component is rounded per line
// (half up); CGST and SGST/UTGST are always equal. These rounding choices are
// assumptions shown to the user, not rules of law: confirm with a tax
// professional.
func Calculate(in Input) (Result, error) {
	var res Result
	if len(in.Lines) == 0 {
		return res, ErrNoLines
	}
	sup, ok1 := LookupState(in.SupplierState)
	pos, ok2 := LookupState(in.PlaceOfSupply)
	if !ok1 || !ok2 || sup.Status != StateCurrent || pos.Status != StateCurrent {
		return res, ErrUnknownState
	}
	note := func(key string, kv ...string) {
		args := map[string]string{}
		for i := 0; i+1 < len(kv); i += 2 {
			args[kv[i]] = kv[i+1]
		}
		res.Notes = append(res.Notes, Note{Key: key, Args: args})
	}

	collectsTax := in.SupplierKind == RegularSupplier
	res.DocType = TaxInvoice
	if !collectsTax {
		res.DocType = BillOfSupply
		note("gst.noTaxCollected." + string(in.SupplierKind))
	}

	supply := in.SupplyKind
	if supply == "" {
		supply = DomesticSupply
	}
	res.IntraState = supply == DomesticSupply && in.SupplierState == in.PlaceOfSupply
	res.StateTaxName = "SGST"
	switch {
	case supply != DomesticSupply:
		note("gst.interState.selectedSupplyKind", "kind", string(supply))
	case res.IntraState:
		if pos.UTGST {
			res.StateTaxName = "UTGST"
		}
		note("gst.intraState", "supplierState", in.SupplierState, "placeOfSupply", in.PlaceOfSupply, "stateTax", res.StateTaxName)
	default:
		note("gst.interState", "supplierState", in.SupplierState, "placeOfSupply", in.PlaceOfSupply)
	}

	res.TaxableTotal, res.CGST, res.SGST, res.IGST = newInt(), newInt(), newInt(), newInt()
	res.Cess, res.TaxTotal = newInt(), newInt()
	hundred := big.NewRat(100, 1)
	two := big.NewRat(2, 1)
	taxableLines := 0

	for _, l := range in.Lines {
		disc := l.Discount
		if disc == nil {
			disc = new(money.Rat)
		}
		taxableVal := money.Round(new(money.Rat).Sub(l.Gross, disc))
		if taxableVal.Sign() < 0 {
			return Result{}, ErrNegativeValue
		}
		lr := LineResult{Code: l.Code, Taxable: taxableVal, CGST: newInt(), SGST: newInt(), IGST: newInt(), Cess: newInt(), Class: Taxable}
		if collectsTax {
			rule, err := in.Rules.Resolve(l.Code, in.Date)
			if err != nil {
				return Result{}, err
			}
			lr.RuleID, lr.Class, lr.Rate, lr.CessRate = rule.ID, rule.Class, rule.Rate, rule.CessRate
			if rule.Class == Taxable {
				taxableLines++
				base := new(money.Rat).SetInt(taxableVal)
				if rule.Rate != nil {
					if res.IntraState {
						half := new(money.Rat).Quo(rule.Rate, two)
						c := money.Round(new(money.Rat).Quo(new(money.Rat).Mul(base, half), hundred))
						lr.CGST.Set(c)
						lr.SGST.Set(c)
					} else {
						lr.IGST = money.Round(new(money.Rat).Quo(new(money.Rat).Mul(base, rule.Rate), hundred))
					}
				}
				if rule.CessRate != nil {
					lr.Cess = money.Round(new(money.Rat).Quo(new(money.Rat).Mul(base, rule.CessRate), hundred))
				}
			}
		}
		res.TaxableTotal.Add(res.TaxableTotal, lr.Taxable)
		res.CGST.Add(res.CGST, lr.CGST)
		res.SGST.Add(res.SGST, lr.SGST)
		res.IGST.Add(res.IGST, lr.IGST)
		res.Cess.Add(res.Cess, lr.Cess)
		res.Lines = append(res.Lines, lr)
	}
	for _, v := range []*big.Int{res.CGST, res.SGST, res.IGST, res.Cess} {
		res.TaxTotal.Add(res.TaxTotal, v)
	}

	if collectsTax && taxableLines == 0 {
		res.NeedsReview = true
		note("gst.review.noTaxableLinesConsiderBillOfSupply")
	}
	res.TaxCollected, res.PayableByRecipient = new(big.Int).Set(res.TaxTotal), newInt()
	if in.ReverseCharge && collectsTax {
		res.TaxCollected, res.PayableByRecipient = newInt(), new(big.Int).Set(res.TaxTotal)
		note("gst.reverseCharge")
	}
	res.InvoiceTotal = new(big.Int).Add(res.TaxableTotal, res.TaxCollected)
	return res, nil
}
