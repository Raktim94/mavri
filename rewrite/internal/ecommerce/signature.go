// Package ecommerce holds the e-commerce webhook rules that do not need a
// database: signature schemes, verification and event hashing.
package ecommerce

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"strings"
)

// Platform identifies the sender of a webhook.
type Platform string

const (
	Shopify     Platform = "shopify"
	WooCommerce Platform = "woocommerce"
	Generic     Platform = "generic"
)

type scheme struct {
	header string
	hex    bool // otherwise base64
}

var schemes = map[Platform]scheme{
	Shopify:     {"x-shopify-hmac-sha256", false},
	WooCommerce: {"x-wc-webhook-signature", false},
	Generic:     {"x-webhook-signature", true},
}

// SignatureHeader is the request header that carries the signature, or ""
// for an unknown platform.
func SignatureHeader(p Platform) string { return schemes[p].header }

// VerifySignature checks an HMAC-SHA256 signature over the exact raw request
// bytes. Unknown platforms, missing or malformed signatures all return false.
// Never pass a re-serialised JSON body: key order and whitespace would differ.
func VerifySignature(p Platform, rawBody []byte, headerValue, secret string) bool {
	s, ok := schemes[p]
	headerValue = strings.TrimSpace(headerValue)
	if !ok || headerValue == "" || secret == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(rawBody)
	expected := mac.Sum(nil)

	var got []byte
	var err error
	if s.hex {
		got, err = hex.DecodeString(headerValue)
	} else {
		got, err = base64.StdEncoding.DecodeString(headerValue)
		if err != nil {
			got, err = base64.RawStdEncoding.DecodeString(headerValue)
		}
	}
	if err != nil {
		return false
	}
	return hmac.Equal(got, expected)
}

// PayloadHash is the SHA-256 (hex) of the raw body, used to recognise a
// re-delivered event for idempotency.
func PayloadHash(rawBody []byte) string {
	sum := sha256.Sum256(rawBody)
	return hex.EncodeToString(sum[:])
}

// GenerateWebhookSecret returns "whsec_" plus 32 random bytes, base64url.
func GenerateWebhookSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "whsec_" + base64.RawURLEncoding.EncodeToString(b), nil
}
