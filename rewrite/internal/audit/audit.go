// Package audit is a tamper-evident, append-only activity log.
//
// Each entry commits to the one before it with a SHA-256 hash chain, so
// editing, deleting or reordering entries is detectable. This is tamper-
// EVIDENT, not tamper-proof: someone who can rewrite the whole store can
// recompute every hash. Export the head hash somewhere the database
// administrator cannot change and check it with VerifyAgainstAnchor.
//
// Entries must never contain passwords, API keys, webhook secrets, payment
// credentials or invoice contents; log identifiers and action names only.
package audit

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"strings"
	"time"
)

// Genesis is the previous hash of the first entry.
var Genesis = strings.Repeat("0", 64)

// ErrBroken is returned when the chain does not verify.
var ErrBroken = errors.New("error.audit.chainBroken")

// Entry is one log record.
type Entry struct {
	Seq      uint64
	At       time.Time
	Actor    string // user or API-key id
	Action   string // e.g. "invoice.issue"
	Subject  string // e.g. "invoice:123"
	Detail   string // short, non-sensitive
	PrevHash string
	Hash     string
}

func field(h interface{ Write([]byte) (int, error) }, s string) {
	var n [8]byte
	binary.BigEndian.PutUint64(n[:], uint64(len(s)))
	h.Write(n[:]) // length-prefix so field boundaries cannot be forged
	h.Write([]byte(s))
}

func compute(e Entry) string {
	h := sha256.New()
	var seq [8]byte
	binary.BigEndian.PutUint64(seq[:], e.Seq)
	h.Write(seq[:])
	field(h, e.At.UTC().Format(time.RFC3339Nano))
	field(h, e.Actor)
	field(h, e.Action)
	field(h, e.Subject)
	field(h, e.Detail)
	field(h, e.PrevHash)
	return hex.EncodeToString(h.Sum(nil))
}

// Log appends entries in memory; callers persist them.
type Log struct{ entries []Entry }

// Append adds an entry and returns it.
func (l *Log) Append(at time.Time, actor, action, subject, detail string) Entry {
	prev := Genesis
	if n := len(l.entries); n > 0 {
		prev = l.entries[n-1].Hash
	}
	e := Entry{Seq: uint64(len(l.entries) + 1), At: at, Actor: actor, Action: action, Subject: subject, Detail: detail, PrevHash: prev}
	e.Hash = compute(e)
	l.entries = append(l.entries, e)
	return e
}

// Entries returns a copy of the log.
func (l *Log) Entries() []Entry { return append([]Entry(nil), l.entries...) }

// Head is the hash of the newest entry, or Genesis for an empty log.
func Head(entries []Entry) string {
	if len(entries) == 0 {
		return Genesis
	}
	return entries[len(entries)-1].Hash
}

// Verify checks sequence numbers, links and hashes. On failure it returns the
// sequence number of the first bad entry.
func Verify(entries []Entry) (badSeq uint64, err error) {
	prev := Genesis
	for i, e := range entries {
		if e.Seq != uint64(i+1) || e.PrevHash != prev || e.Hash != compute(e) {
			return e.Seq, ErrBroken
		}
		prev = e.Hash
	}
	return 0, nil
}

// VerifyAgainstAnchor additionally requires the chain to end at a head hash
// recorded elsewhere, which exposes truncation of recent entries.
func VerifyAgainstAnchor(entries []Entry, anchor string) error {
	if _, err := Verify(entries); err != nil {
		return err
	}
	if Head(entries) != anchor {
		return ErrBroken
	}
	return nil
}
