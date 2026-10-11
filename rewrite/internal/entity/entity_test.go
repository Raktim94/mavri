package entity

import (
	"bytes"
	"errors"
	"testing"
)

func TestDecodeBase64IsAsLenientAsNode(t *testing.T) {
	want := []byte{0x89, 'P', 'N', 'G', 0xfb, 0xff}
	for _, in := range []string{"iVBORvv/", "iVBORvv/\n", "iVBORvv_", "iVBO Rvv/", "iVBORvv/===", "iVBORvv-"} {
		if got := decodeBase64(in); !bytes.Equal(got, want) {
			t.Errorf("%q -> %x", in, got)
		}
	}
	if got := decodeBase64("QQ"); string(got) != "A" {
		t.Errorf("unpadded: %q", got)
	}
	if got := decodeBase64("!!!"); len(got) != 0 {
		t.Errorf("garbage should decode to nothing: %x", got)
	}
}

func TestParseFilter(t *testing.T) {
	got := ParseFilter(`[{"type":"Active","value":""},{"type":"Nope","value":"x"},{"type":"Status","value":3},"x",{"type":"Date","value":"a,b"}]`)
	if len(got) != 2 || got[0].Type != "Active" || got[1].Value != "a,b" {
		t.Errorf("%v", got)
	}
	for _, bad := range []string{"", "nope", "{}", "null", "[1,2]"} {
		if len(ParseFilter(bad)) != 0 {
			t.Errorf("%q should give no filters", bad)
		}
	}
}

func TestMapError(t *testing.T) {
	cases := map[string]string{
		"constraint failed: UNIQUE constraint failed: banks.x (2067)": "error.invalidConstraintUnique",
		"FOREIGN KEY constraint failed (787)":                         "error.invalidConstraintForeign",
		"NOT NULL constraint failed: clients.name (1299)":             "error.invalidConstraintNotNull",
		"CHECK constraint failed: x (275)":                            "error.invalidConstraintCheck",
		"database is locked (5)":                                      "error.databaseLocked",
		"SQL logic error: no such table: nope (1)":                    "error.unknownError",
	}
	for msg, key := range cases {
		if got := MapError(errors.New(msg)); got.Key != key {
			t.Errorf("%q -> %s, want %s", msg, got.Key, key)
		}
	}
	if f := MapError(errors.New("boom")); f.Message != "boom" {
		t.Errorf("unknown errors carry their message: %+v", f)
	}
	own := &Failure{Key: "error.x"}
	if MapError(own) != own {
		t.Error("a Failure passes through unchanged")
	}
}

func TestIDFromPath(t *testing.T) {
	if IDFromPath("42") != 42 || IDFromPath("abc") != -1 || IDFromPath("") != -1 {
		t.Error("id parsing")
	}
}
