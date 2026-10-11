package ecommerce

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

type fx struct{ Secret, Body, Base64, Hex string }

func load(t *testing.T) fx {
	t.Helper()
	b, err := os.ReadFile("testdata/webhook.json")
	if err != nil {
		t.Fatal(err)
	}
	var f fx
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

func TestVerifiesSignaturesComputedByNode(t *testing.T) {
	f := load(t)
	body := []byte(f.Body)
	cases := []struct {
		p   Platform
		sig string
	}{{Shopify, f.Base64}, {WooCommerce, f.Base64}, {Generic, f.Hex}, {Generic, strings.ToUpper(f.Hex)}, {Shopify, " " + f.Base64 + "\n"}}
	for _, c := range cases {
		if !VerifySignature(c.p, body, c.sig, f.Secret) {
			t.Errorf("%s: valid signature rejected (%q)", c.p, c.sig)
		}
	}
}

func TestRejectsInvalid(t *testing.T) {
	f := load(t)
	body := []byte(f.Body)
	tampered := []byte(strings.Replace(f.Body, "10.00", "99.00", 1))
	if tampered[0] == 0 || string(tampered) == f.Body {
		t.Fatal("test bug: body not tampered")
	}
	bad := []struct {
		name string
		ok   bool
	}{
		{"tampered body", VerifySignature(Shopify, tampered, f.Base64, f.Secret)},
		{"wrong secret", VerifySignature(Shopify, body, f.Base64, "whsec_other")},
		{"empty secret", VerifySignature(Shopify, body, f.Base64, "")},
		{"missing signature", VerifySignature(Shopify, body, "", f.Secret)},
		{"base64 sent to hex scheme", VerifySignature(Generic, body, f.Base64, f.Secret)},
		{"hex sent to base64 scheme", VerifySignature(Shopify, body, f.Hex, f.Secret)},
		{"truncated", VerifySignature(Generic, body, f.Hex[:20], f.Secret)},
		{"garbage", VerifySignature(Generic, body, "not hex!", f.Secret)},
		{"unknown platform", VerifySignature(Platform("stripe"), body, f.Hex, f.Secret)},
	}
	for _, c := range bad {
		if c.ok {
			t.Errorf("%s accepted", c.name)
		}
	}
}

func TestHeaderNamesAndHelpers(t *testing.T) {
	if SignatureHeader(Shopify) != "x-shopify-hmac-sha256" || SignatureHeader(WooCommerce) != "x-wc-webhook-signature" ||
		SignatureHeader(Generic) != "x-webhook-signature" || SignatureHeader("x") != "" {
		t.Fatal("wrong header names")
	}
	if PayloadHash([]byte("abc")) != "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" {
		t.Fatal("SHA-256 of abc wrong")
	}
	s, err := GenerateWebhookSecret()
	if err != nil || !strings.HasPrefix(s, "whsec_") || len(s) != 6+43 {
		t.Fatalf("bad secret %q %v", s, err)
	}
}
