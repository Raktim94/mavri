package billing

import (
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// LateFeePolicy describes a late-payment charge. All parts are optional.
// AnnualPercent accrues as simple daily interest (days/365) on the overdue
// balance after the grace period; it is not compounded and the fee itself
// never accrues interest. Whether such charges are allowed or enforceable is
// a matter of contract and law, which Mavri does not decide.
type LateFeePolicy struct {
	GraceDays     int
	FixedFee      int64      // charged once when any overdue day beyond grace exists
	AnnualPercent *money.Rat // e.g. "18" for 18% a year
	Cap           int64      // 0 means no cap
}

// Compute returns the late fee in minor units as of asOf.
func (p LateFeePolicy) Compute(outstanding int64, due, asOf time.Time) int64 {
	days := DaysOverdue(due, asOf) - p.GraceDays
	if days <= 0 || outstanding <= 0 {
		return 0
	}
	fee := p.FixedFee
	if p.AnnualPercent != nil {
		v := new(money.Rat).SetInt64(outstanding)
		v.Mul(v, p.AnnualPercent)
		v.Mul(v, new(money.Rat).SetInt64(int64(days)))
		v.Quo(v, money.MustDecimal("36500")) // 100 (percent) x 365 (days)
		fee += money.Round(v).Int64()
	}
	if p.Cap > 0 && fee > p.Cap {
		fee = p.Cap
	}
	return fee
}
