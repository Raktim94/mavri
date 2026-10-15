package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/model"
)

func sig(secret, body string, at time.Time) string {
	m := hmac.New(sha256.New, []byte(secret))
	ts := strconv.FormatInt(at.Unix(), 10)
	m.Write([]byte(ts + "." + body))
	return "t=" + ts + ",v1=" + hex.EncodeToString(m.Sum(nil))
}

func TestVerify(t *testing.T) {
	now := time.Now()
	body := `{"id":"evt_1"}`
	good := sig("whsec_a", body, now)
	if err := Verify("whsec_a", []byte(body), good, now, 5*time.Minute); err != nil {
		t.Fatalf("good: %v", err)
	}
	// Stripe may send several v1 values while a secret is being rolled; any match is enough.
	if err := Verify("whsec_a", []byte(body), good+",v1=deadbeef", now, 5*time.Minute); err != nil {
		t.Fatalf("extra v1: %v", err)
	}
	for name, h := range map[string]string{
		"wrong secret": sig("whsec_b", body, now),
		"old":          sig("whsec_a", body, now.Add(-10*time.Minute)),
		"future":       sig("whsec_a", body, now.Add(10*time.Minute)),
		"no t":         "v1=abc",
		"no v1":        "t=123",
		"empty":        "",
		"tampered":     good[:len(good)-1] + string(rune('a'+(good[len(good)-1]-'a'+1)%6)),
	} {
		if Verify("whsec_a", []byte(body), h, now, 5*time.Minute) == nil {
			t.Errorf("%s was accepted", name)
		}
	}
	if Verify("whsec_a", []byte(body+" "), good, now, 5*time.Minute) == nil {
		t.Error("a changed body was accepted")
	}
}

func TestPayable(t *testing.T) {
	d := model.Document{Kind: "invoice", Status: "unpaid", Totals: model.Totals{TotalCents: 1000}, PaidCents: 250}
	if Payable(d) != 750 {
		t.Fatalf("balance: %d", Payable(d))
	}
	for name, mod := range map[string]func(*model.Document){
		"paid":  func(x *model.Document) { x.Status = "paid" },
		"void":  func(x *model.Document) { x.Status = "void" },
		"quote": func(x *model.Document) { x.Kind = "quote"; x.Status = "open" },
		"zero":  func(x *model.Document) { x.PaidCents = 1000 },
	} {
		x := d
		mod(&x)
		if Payable(x) != 0 {
			t.Errorf("%s is payable", name)
		}
	}
}
