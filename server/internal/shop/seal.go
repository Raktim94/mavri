// Package shop connects online stores: signed webhooks and the order API turn
// paid orders into invoices exactly once.
package shop

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// Box encrypts the secrets of stores at rest with AES-256-GCM.
type Box struct{ key []byte }

// NewBox uses the 32-byte key in b64 (standard base64) if given, otherwise a
// key stored in dir/secret.key, creating it on first use.
func NewBox(dir, b64 string) (*Box, error) {
	if b64 != "" {
		k, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
		if err != nil || len(k) != 32 {
			return nil, errors.New("ENCRYPTION_KEY must be 32 bytes in base64 (try: openssl rand -base64 32)")
		}
		return &Box{k}, nil
	}
	path := filepath.Join(dir, "secret.key")
	if raw, err := os.ReadFile(path); err == nil {
		if k, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(raw))); err == nil && len(k) == 32 {
			return &Box{k}, nil
		}
		return nil, errors.New(path + " is not a valid key file")
	}
	k := make([]byte, 32)
	if _, err := rand.Read(k); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, []byte(base64.StdEncoding.EncodeToString(k)+"\n"), 0o600); err != nil {
		return nil, err
	}
	return &Box{k}, nil
}

// Seal returns "nonce.ciphertext" in base64.
func (b *Box) Seal(plain string) (string, error) {
	gcm, err := b.gcm()
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	ct := gcm.Seal(nil, nonce, []byte(plain), nil)
	return base64.RawStdEncoding.EncodeToString(nonce) + "." + base64.RawStdEncoding.EncodeToString(ct), nil
}

// Open reverses Seal.
func (b *Box) Open(sealed string) (string, error) {
	gcm, err := b.gcm()
	if err != nil {
		return "", err
	}
	parts := strings.Split(sealed, ".")
	if len(parts) != 2 {
		return "", errors.New("malformed sealed value")
	}
	nonce, err1 := base64.RawStdEncoding.DecodeString(parts[0])
	ct, err2 := base64.RawStdEncoding.DecodeString(parts[1])
	if err1 != nil || err2 != nil || len(nonce) != gcm.NonceSize() {
		return "", errors.New("malformed sealed value")
	}
	pt, err := gcm.Open(nil, nonce, ct, nil)
	return string(pt), err
}

func (b *Box) gcm() (cipher.AEAD, error) {
	blk, err := aes.NewCipher(b.key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(blk)
}

// SignatureHeader is the request header a platform puts its signature in.
func SignatureHeader(platform string) string {
	switch platform {
	case "shopify":
		return "X-Shopify-Hmac-Sha256"
	case "woocommerce":
		return "X-WC-Webhook-Signature"
	case "generic":
		return "X-Webhook-Signature"
	}
	return ""
}

// Sign computes the signature a platform would send for body: HMAC-SHA256,
// base64 for Shopify and WooCommerce, hex for the generic sender.
func Sign(platform string, body []byte, secret string) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write(body)
	sum := m.Sum(nil)
	if platform == "generic" {
		return hex.EncodeToString(sum)
	}
	return base64.StdEncoding.EncodeToString(sum)
}

// Verify checks a received signature in constant time.
func Verify(platform string, body []byte, got, secret string) bool {
	if SignatureHeader(platform) == "" || got == "" {
		return false
	}
	want := Sign(platform, body, secret)
	return subtle.ConstantTimeCompare([]byte(want), []byte(strings.TrimSpace(got))) == 1
}
