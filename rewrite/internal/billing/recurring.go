package billing

import (
	"errors"
	"time"
)

// Frequency of a recurring invoice.
type Frequency string

const (
	Daily     Frequency = "daily"
	Weekly    Frequency = "weekly"
	Monthly   Frequency = "monthly"
	Quarterly Frequency = "quarterly"
	Yearly    Frequency = "yearly"
)

// ErrInvalidSchedule is returned for an unusable schedule.
var ErrInvalidSchedule = errors.New("error.billing.invalidSchedule")

// Schedule says when recurring invoices are generated. Dates are calendar
// dates. Every run is computed from Start, never from the previous run, so a
// schedule anchored on the 31st returns to the 31st after a short month
// instead of drifting to the 28th forever.
type Schedule struct {
	Frequency Frequency
	Interval  int       // every N units, at least 1
	Start     time.Time // first run
	End       time.Time // optional last possible run (inclusive); zero means none
	MaxRuns   int       // optional cap on the total number of runs; zero means none
}

// Validate checks the schedule.
func (s Schedule) Validate() error {
	switch s.Frequency {
	case Daily, Weekly, Monthly, Quarterly, Yearly:
	default:
		return ErrInvalidSchedule
	}
	if s.Interval < 1 || s.Start.IsZero() || s.MaxRuns < 0 || (!s.End.IsZero() && Day(s.End).Before(Day(s.Start))) {
		return ErrInvalidSchedule
	}
	return nil
}

func addMonthsClamped(anchor time.Time, months int) time.Time {
	y, m, day := anchor.Date()
	first := time.Date(y, m+time.Month(months), 1, 0, 0, 0, 0, time.UTC)
	last := time.Date(first.Year(), first.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if day > last {
		day = last
	}
	return time.Date(first.Year(), first.Month(), day, 0, 0, 0, 0, time.UTC)
}

func (s Schedule) run(k int) time.Time {
	start := Day(s.Start)
	switch s.Frequency {
	case Daily:
		return start.AddDate(0, 0, k*s.Interval)
	case Weekly:
		return start.AddDate(0, 0, 7*k*s.Interval)
	case Monthly:
		return addMonthsClamped(start, k*s.Interval)
	case Quarterly:
		return addMonthsClamped(start, 3*k*s.Interval)
	}
	return addMonthsClamped(start, 12*k*s.Interval)
}

// Next returns up to n run dates strictly after the given date.
func (s Schedule) Next(after time.Time, n int) ([]time.Time, error) {
	if err := s.Validate(); err != nil {
		return nil, err
	}
	var out []time.Time
	a := Day(after)
	for k := 0; len(out) < n && k < 200000; k++ {
		if s.MaxRuns > 0 && k >= s.MaxRuns {
			break
		}
		d := s.run(k)
		if !s.End.IsZero() && d.After(Day(s.End)) {
			break
		}
		if d.After(a) {
			out = append(out, d)
		}
	}
	return out, nil
}
