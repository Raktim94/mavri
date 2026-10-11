package secrets

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRoundTripAndFormat(t *testing.T) {
	b := &Box{Dir: t.TempDir()}
	enc, err := b.Encrypt("whsec_example")
	if err != nil {
		t.Fatal(err)
	}
	if parts := strings.Split(enc, "."); len(parts) != 3 {
		t.Fatalf("format: %q", enc)
	}
	if got, err := b.Decrypt(enc); err != nil || got != "whsec_example" {
		t.Errorf("decrypt: %q %v", got, err)
	}
	other, _ := b.Encrypt("whsec_example")
	if other == enc {
		t.Error("each encryption must use a fresh IV")
	}
	if _, err := os.Stat(filepath.Join(b.Dir, ".encryption_key")); err != nil {
		t.Errorf("key file not written: %v", err)
	}
	// A second box on the same directory reads the same key.
	if got, err := (&Box{Dir: b.Dir}).Decrypt(enc); err != nil || got != "whsec_example" {
		t.Errorf("key not persisted: %q %v", got, err)
	}
}

func TestTamperingAndWrongKey(t *testing.T) {
	b := &Box{Dir: t.TempDir()}
	enc, _ := b.Encrypt("secret")
	parts := strings.Split(enc, ".")
	for name, bad := range map[string]string{
		"flipped ciphertext": parts[0] + "." + parts[1] + "." + "AAAA" + parts[2][4:],
		"missing part":       parts[0] + "." + parts[1],
		"empty":              "",
		"not base64":         "a.b.c",
	} {
		if _, err := b.Decrypt(bad); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	if _, err := (&Box{Dir: t.TempDir()}).Decrypt(enc); err == nil {
		t.Error("a different key must not decrypt")
	}
}

// The value below was produced by the TypeScript server (Node's crypto) with
// the pinned key, so existing integrations keep working after the switch.
func TestReadsValuesWrittenByNode(t *testing.T) {
	key := strings.Repeat("0123456789abcdef", 4)
	b := &Box{Dir: t.TempDir(), EnvKey: key}
	got, err := b.Decrypt(nodeFixture)
	if err != nil || got != "whsec_from_node" {
		t.Fatalf("%q %v", got, err)
	}
}

// nodeFixture is AES-256-GCM output from Node for the pinned key above.
const nodeFixture = "JfkxVVe4k0hF40b3.4GmFiyEpqA5DWeGHccNqXA==.3hcgeg08JC8RcAMNwF5S"
