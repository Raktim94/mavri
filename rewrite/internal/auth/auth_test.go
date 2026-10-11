package auth

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"
)

type fixtures struct {
	Passwords []struct{ Password, Stored string }
	APIKeys   []struct{ Raw, Hash string }
}

func load(t *testing.T) fixtures {
	t.Helper()
	b, err := os.ReadFile("testdata/fixtures.json")
	if err != nil {
		t.Fatal(err)
	}
	var f fixtures
	if err := json.Unmarshal(b, &f); err != nil {
		t.Fatal(err)
	}
	return f
}

// Stored hashes in the fixtures were produced with the exact TypeScript code
// path, so passing proves existing accounts will still log in.
func TestVerifiesHashesWrittenByTypeScript(t *testing.T) {
	for _, c := range load(t).Passwords {
		if !VerifyPassword(c.Password, c.Stored) {
			t.Errorf("valid password rejected for %q", c.Password)
		}
		if VerifyPassword(c.Password+"x", c.Stored) {
			t.Errorf("wrong password accepted for %q", c.Password)
		}
	}
}

func TestHashRoundTripAndFormat(t *testing.T) {
	h, err := HashPassword("RoundTrip1234")
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(h, ":")
	if len(parts) != 6 || parts[0] != "scrypt" || parts[1] != "16384" || parts[2] != "8" || parts[3] != "1" ||
		len(parts[4]) != 32 || len(parts[5]) != 128 {
		t.Fatalf("unexpected format %q", h)
	}
	if !VerifyPassword("RoundTrip1234", h) || VerifyPassword("roundtrip1234", h) {
		t.Fatal("round trip failed")
	}
	h2, _ := HashPassword("RoundTrip1234")
	if h == h2 {
		t.Fatal("salts must differ")
	}
}

func TestVerifyRejectsMalformed(t *testing.T) {
	good := load(t).Passwords[0]
	parts := strings.Split(good.Stored, ":")
	bad := []string{
		"", "plain", "bcrypt:1:2:3:4:5",
		strings.Join(parts[:5], ":"),
		"scrypt:16384:8:1:" + parts[4] + ":", // empty hash
		"scrypt:16384:8:1:" + parts[4] + ":zz",
		"scrypt:abc:8:1:" + parts[4] + ":" + parts[5],
		"scrypt:1048576:8:1:" + parts[4] + ":" + parts[5], // over memory cap
		"scrypt:16383:8:1:" + parts[4] + ":" + parts[5],   // not a power of two
	}
	for _, s := range bad {
		if VerifyPassword(good.Password, s) {
			t.Errorf("accepted malformed %q", s)
		}
	}
}

func TestAPIKeyHashMatchesTypeScript(t *testing.T) {
	for _, k := range load(t).APIKeys {
		got, err := HashAPIKey(k.Raw)
		if err != nil || got != k.Hash {
			t.Errorf("key %q: got %s err %v want %s", k.Raw, got, err, k.Hash)
		}
	}
}

func TestGenerateAPIKey(t *testing.T) {
	raw, prefix, err := GenerateAPIKey()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(raw, "ndr_") || len(raw) != 4+43 || prefix != raw[:12] || strings.ContainsAny(raw, "=+/") {
		t.Fatalf("bad key %q prefix %q", raw, prefix)
	}
	if !LooksLikeAPIKey(raw) || LooksLikeAPIKey("Bearer x") {
		t.Fatal("prefix check wrong")
	}
	raw2, _, _ := GenerateAPIKey()
	if raw == raw2 {
		t.Fatal("keys must be random")
	}
}

func TestPasswordPolicy(t *testing.T) {
	cases := map[string]bool{
		"Abcdefghi1": true, "abcdefghi1": false, "ABCDEFGHI1": false, "Abcdefghij": false,
		"Abcdefg1": false, "Passw0rd😀😀": true, "Pass1😀😀😀😀": true, "Pä1😀😀😀😀": false,
		"": false,
	}
	for pw, want := range cases {
		if got := IsPasswordStrongEnough(pw); got != want {
			t.Errorf("%q: got %v want %v", pw, got, want)
		}
	}
	// Each emoji is two UTF-16 units, like JavaScript's .length: "Aa1" + 4 emoji = 11.
	if !IsPasswordStrongEnough("Aa1😀😀😀😀") {
		t.Error("length must count UTF-16 code units")
	}
}

func TestLockout(t *testing.T) {
	now := time.Date(2026, 10, 11, 10, 0, 0, 0, time.UTC)
	for c := 0; c < 4; c++ {
		n, l := NextFailedLogin(c, now)
		if n != c+1 || (c+1 < 5) != (l == nil) {
			t.Fatalf("count %d: got %d %v", c, n, l)
		}
	}
	n, l := NextFailedLogin(4, now)
	if n != 5 || l == nil || !l.Equal(now.Add(15*time.Minute)) {
		t.Fatalf("5th failure must lock for 15 min, got %d %v", n, l)
	}
	if n, l = NextFailedLogin(5, now); n != 6 || l == nil {
		t.Fatal("count is not reset after expiry, so the next failure locks again")
	}
	ts := FormatTimestamp(now.Add(15 * time.Minute))
	if ts != "2026-10-11T10:15:00.000Z" {
		t.Fatalf("timestamp format %q", ts)
	}
	if !IsLocked(ts, now) || IsLocked(ts, now.Add(16*time.Minute)) || IsLocked("", now) || IsLocked("garbage", now) {
		t.Fatal("IsLocked wrong")
	}
}
