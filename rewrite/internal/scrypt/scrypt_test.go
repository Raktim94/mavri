package scrypt

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"testing"
)

type vector struct {
	Password string `json:"password"`
	Salt     string `json:"salt"`
	N, R, P  int
	KeyLen   int    `json:"keyLen"`
	Hex      string `json:"hex"`
}

// The vectors were produced by Node's crypto.scryptSync (the function the
// existing app used). The first two are also the RFC 7914 section 12 vectors.
func TestMatchesNode(t *testing.T) {
	raw, err := os.ReadFile("testdata/vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vs []vector
	if err := json.Unmarshal(raw, &vs); err != nil {
		t.Fatal(err)
	}
	if len(vs) < 7 {
		t.Fatalf("expected at least 7 vectors, got %d", len(vs))
	}
	for _, v := range vs {
		got, err := Key([]byte(v.Password), []byte(v.Salt), v.N, v.R, v.P, v.KeyLen)
		if err != nil {
			t.Fatalf("N=%d r=%d p=%d: %v", v.N, v.R, v.P, err)
		}
		if hex.EncodeToString(got) != v.Hex {
			t.Errorf("N=%d r=%d p=%d pw=%q:\n got  %x\n want %s", v.N, v.R, v.P, v.Password, got, v.Hex)
		}
	}
}

func TestRejectsBadParams(t *testing.T) {
	cases := [][4]int{{0, 1, 1, 32}, {1, 1, 1, 32}, {3, 1, 1, 32}, {16, 0, 1, 32}, {16, 1, 0, 32}, {16, 1, 1, 0},
		{1 << 20, 8, 1, 32}} // 1 GiB of memory
	for _, c := range cases {
		if _, err := Key([]byte("p"), []byte("s"), c[0], c[1], c[2], c[3]); err == nil {
			t.Errorf("params %v should be rejected", c)
		}
	}
}
