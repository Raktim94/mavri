package billing

import "time"

// Step is one reminder in a policy: OffsetDays is relative to the due date
// (negative = before, 0 = on the day, positive = after).
type Step struct {
	OffsetDays int
	Template   string // translation/template key, e.g. "reminder.firstOverdue"
}

// Policy is an ordered reminder plan.
type Policy struct{ Steps []Step }

// Plan is what to do right now for one invoice.
type Plan struct {
	Send    *Step  // the single reminder to send now, if any
	Skipped []Step // earlier steps that became eligible but were never sent
}

// DueNow decides which reminder to send. Only issued or partially paid
// invoices are chased. If several unsent steps are eligible (for example the
// reminder service was down), only the latest is sent and the older ones are
// reported as skipped, so a customer never receives a burst of reminders.
// sentOffsets lists the OffsetDays already sent for this invoice.
func (p Policy) DueNow(status Status, due, asOf time.Time, sentOffsets []int) Plan {
	if status != Issued && status != PartiallyPaid {
		return Plan{}
	}
	sent := map[int]bool{}
	for _, o := range sentOffsets {
		sent[o] = true
	}
	var eligible []Step
	for _, s := range p.Steps {
		if sent[s.OffsetDays] {
			continue
		}
		if !Day(asOf).Before(Day(due).AddDate(0, 0, s.OffsetDays)) {
			eligible = append(eligible, s)
		}
	}
	if len(eligible) == 0 {
		return Plan{}
	}
	latest := eligible[0]
	for _, s := range eligible {
		if s.OffsetDays > latest.OffsetDays {
			latest = s
		}
	}
	plan := Plan{Send: &latest}
	for _, s := range eligible {
		if s != latest {
			plan.Skipped = append(plan.Skipped, s)
		}
	}
	return plan
}
