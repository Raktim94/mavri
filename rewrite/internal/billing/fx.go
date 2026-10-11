package billing

import (
	"errors"
	"math/big"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// Errors (translation keys).
var (
	ErrInvalidRate  = errors.New("error.billing.invalidExchangeRate")
	ErrRateMetadata = errors.New("error.billing.exchangeRateMetadataMissing")
)

// Conversion is a currency conversion shown next to, never instead of, the
// invoice's own amount. The invoice keeps its legal currency and total; this
// record only explains a converted figure for reporting.
type Conversion struct {
	SourceCurrency, TargetCurrency string
	SourceAmount                   int64      // minor units of the source currency
	Rate                           *money.Rat // target units per 1 source unit
	RateSource                     string     // where the rate came from
	EffectiveAt                    time.Time
	Rounding                       string // always "half_up"
	Converted                      int64  // minor units of the target currency
}

// Convert converts an amount. The minor-unit digit counts come from the
// currency records (never assumed here). The rate must name its source and
// effective time so the figure can be audited.
func Convert(srcCur, dstCur string, srcAmount int64, srcDigits, dstDigits int, rate *money.Rat, rateSource string, effectiveAt time.Time) (Conversion, error) {
	if srcCur == "" || dstCur == "" || srcCur == dstCur || srcDigits < 0 || dstDigits < 0 || srcDigits > 6 || dstDigits > 6 {
		return Conversion{}, ErrInvalidRate
	}
	if rate == nil || rate.Sign() <= 0 {
		return Conversion{}, ErrInvalidRate
	}
	if rateSource == "" || effectiveAt.IsZero() {
		return Conversion{}, ErrRateMetadata
	}
	pow := func(d int) *money.Rat {
		return new(money.Rat).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(d)), nil))
	}
	major := new(money.Rat).Quo(new(money.Rat).SetInt64(srcAmount), pow(srcDigits))
	target := new(money.Rat).Mul(major, rate)
	target.Mul(target, pow(dstDigits))
	return Conversion{SourceCurrency: srcCur, TargetCurrency: dstCur, SourceAmount: srcAmount, Rate: new(money.Rat).Set(rate),
		RateSource: rateSource, EffectiveAt: effectiveAt, Rounding: "half_up", Converted: money.Round(target).Int64()}, nil
}
