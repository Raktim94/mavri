package audit

import (
	"errors"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 11, 10, 0, 0, 0, time.UTC)

func sample() *Log {
	l := &Log{}
	l.Append(t0, "u1", "invoice.create", "invoice:1", "")
	l.Append(t0.Add(time.Minute), "u1", "invoice.issue", "invoice:1", "")
	l.Append(t0.Add(2*time.Minute), "u2", "payment.record", "invoice:1", "upi")
	return l
}

func TestChainVerifies(t *testing.T) {
	l := sample()
	es := l.Entries()
	if bad, err := Verify(es); err != nil || bad != 0 {
		t.Fatalf("%d %v", bad, err)
	}
	if es[0].PrevHash != Genesis || es[1].PrevHash != es[0].Hash || es[2].Seq != 3 {
		t.Fatal("links")
	}
	if bad, err := Verify(nil); err != nil || bad != 0 || Head(nil) != Genesis {
		t.Fatal("empty log is valid")
	}
}

func TestEditsAreDetected(t *testing.T) {
	mutations := map[string]func([]Entry) []Entry{
		"edit detail":   func(e []Entry) []Entry { e[1].Detail = "x"; return e },
		"edit actor":    func(e []Entry) []Entry { e[0].Actor = "u9"; return e },
		"edit time":     func(e []Entry) []Entry { e[2].At = e[2].At.Add(time.Second); return e },
		"delete middle": func(e []Entry) []Entry { return append(e[:1], e[2:]...) },
		"reorder":       func(e []Entry) []Entry { e[0], e[1] = e[1], e[0]; return e },
		"forge hash":    func(e []Entry) []Entry { e[1].Hash = e[0].Hash; return e },
		"drop first":    func(e []Entry) []Entry { return e[1:] },
	}
	for name, mut := range mutations {
		es := mut(sample().Entries())
		if _, err := Verify(es); !errors.Is(err, ErrBroken) {
			t.Errorf("%s not detected", name)
		}
	}
}

func TestFieldBoundariesCannotBeForged(t *testing.T) {
	a, b := &Log{}, &Log{}
	ea := a.Append(t0, "ab", "c", "s", "")
	eb := b.Append(t0, "a", "bc", "s", "")
	if ea.Hash == eb.Hash {
		t.Fatal("length-prefixing must separate fields")
	}
}

func TestTruncationNeedsAnAnchor(t *testing.T) {
	l := sample()
	anchor := Head(l.Entries())
	if err := VerifyAgainstAnchor(l.Entries(), anchor); err != nil {
		t.Fatal(err)
	}
	truncated := l.Entries()[:2]
	if _, err := Verify(truncated); err != nil {
		t.Fatal("a truncated chain is internally valid; only an anchor reveals it")
	}
	if err := VerifyAgainstAnchor(truncated, anchor); !errors.Is(err, ErrBroken) {
		t.Fatal("anchor must expose truncation")
	}
}

func TestEntriesReturnsCopy(t *testing.T) {
	l := sample()
	es := l.Entries()
	es[0].Detail = "tampered"
	if _, err := Verify(l.Entries()); err != nil {
		t.Fatal("callers must not be able to alter the log through the returned slice")
	}
}
