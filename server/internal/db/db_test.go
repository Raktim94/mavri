package db

import (
	"context"
	"errors"
	"testing"
)

type thing struct {
	ID        int64  `db:"id"`
	Name      string `db:"name"`
	Blob      []byte `db:"blob"`
	Flag      bool   `db:"flag"`
	Ref       *int64 `db:"ref"`
	CreatedAt string `db:"created_at"`
	UpdatedAt string `db:"updated_at"`
	Ignored   string
}

func TestTableCRUD(t *testing.T) {
	d, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	ctx := context.Background()
	if _, err := d.ExecContext(ctx, `CREATE TABLE things (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, blob BLOB NOT NULL, flag INTEGER NOT NULL, ref INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	tb := NewTable[thing]("things")
	a := thing{Name: "a", Flag: true}
	if err := tb.Insert(ctx, d, &a); err != nil || a.ID == 0 || a.CreatedAt == "" {
		t.Fatalf("insert: %+v %v", a, err)
	}
	got, err := tb.Get(ctx, d, a.ID)
	if err != nil || !got.Flag || got.Ref != nil || len(got.Blob) != 0 {
		t.Fatalf("get: %+v %v", got, err)
	}
	seven := int64(7)
	created := got.CreatedAt
	got.Ref, got.Name, got.CreatedAt = &seven, "b", "tampered"
	if err := tb.Update(ctx, d, &got); err != nil {
		t.Fatal(err)
	}
	again, _ := tb.Get(ctx, d, a.ID)
	if again.Name != "b" || again.Ref == nil || *again.Ref != 7 || again.CreatedAt != created {
		t.Fatalf("update: %+v", again)
	}
	if err := tb.Insert(ctx, d, &thing{Name: "b"}); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate: %v", err)
	}
	rows, _ := tb.Select(ctx, d, "WHERE name = ?", "b")
	if len(rows) != 1 {
		t.Fatal("select")
	}
	if err := tb.Delete(ctx, d, 99); !errors.Is(err, ErrNotFound) {
		t.Fatal("delete missing")
	}
	if _, err := tb.Get(ctx, d, 99); !errors.Is(err, ErrNotFound) {
		t.Fatal("get missing")
	}
	if err := tb.Delete(ctx, d, a.ID); err != nil {
		t.Fatal(err)
	}
}

func TestMigrateIsIdempotent(t *testing.T) {
	d, _ := Open(":memory:")
	defer d.Close()
	if err := Migrate(context.Background(), d); err != nil {
		t.Fatal(err)
	}
	var n int
	d.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&n)
	if want := len(migrationNames(t)); n != want {
		t.Fatalf("migrations recorded: %d, want %d", n, want)
	}
}

func migrationNames(t *testing.T) []string {
	t.Helper()
	ents, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range ents {
		out = append(out, e.Name())
	}
	return out
}
