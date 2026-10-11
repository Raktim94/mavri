package schema

import (
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	_ "modernc.org/sqlite"
)

func open(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { db.Close() })
	return db
}

func count(t *testing.T, db *sql.DB, q string) int {
	var n int
	if err := db.QueryRow(q).Scan(&n); err != nil {
		t.Fatal(q, err)
	}
	return n
}

func TestBaselineOnEmptyDatabase(t *testing.T) {
	db := open(t)
	if err := Apply(db); err != nil {
		t.Fatal(err)
	}
	for q, want := range map[string]int{
		`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`: 31,
		`SELECT COUNT(*) FROM units`:              13,
		`SELECT COUNT(*) FROM currencies`:         10,
		`SELECT COUNT(*) FROM layouts`:            6,
		`SELECT COUNT(*) FROM us_sales_tax_rates`: 51,
		`SELECT COUNT(*) FROM settings`:           1,
		`SELECT COUNT(*) FROM migrations`:         33,
		`SELECT COUNT(*) FROM users`:              0,
	} {
		if got := count(t, db, q); got != want {
			t.Errorf("%s = %d, want %d", q, got, want)
		}
	}
	if len(BaselineMigrations()) != 33 {
		t.Errorf("baseline migrations: %d", len(BaselineMigrations()))
	}
	// Applying again must not touch anything.
	if _, err := db.Exec(`INSERT INTO currencies ("code","name") VALUES ('XXX','Test')`); err != nil {
		t.Log("insert skipped:", err)
	}
	before := count(t, db, `SELECT COUNT(*) FROM currencies`)
	if err := Apply(db); err != nil {
		t.Fatal(err)
	}
	if after := count(t, db, `SELECT COUNT(*) FROM currencies`); after != before {
		t.Errorf("second Apply changed data: %d -> %d", before, after)
	}
}

func TestOlderDatabaseIsRejected(t *testing.T) {
	db := open(t)
	if _, err := db.Exec(`CREATE TABLE migrations ("name" TEXT PRIMARY KEY, "appliedAt" TEXT); INSERT INTO migrations ("name") VALUES ('20260105-01-invoice_items-quantity-to-text.cjs')`); err != nil {
		t.Fatal(err)
	}
	err := Apply(db)
	if err == nil || !strings.Contains(err.Error(), "TypeScript server") {
		t.Errorf("want upgrade hint, got %v", err)
	}
}

func TestDevAndBuildMigrationNamesAreEquivalent(t *testing.T) {
	db := open(t)
	if _, err := db.Exec(`CREATE TABLE migrations ("name" TEXT PRIMARY KEY, "appliedAt" TEXT)`); err != nil {
		t.Fatal(err)
	}
	for _, n := range BaselineMigrations() {
		if _, err := db.Exec(`INSERT INTO migrations ("name") VALUES (?)`, n+".ts"); err != nil {
			t.Fatal(err)
		}
	}
	if err := Apply(db); err != nil {
		t.Errorf(".ts names should satisfy the check: %v", err)
	}
}

func TestNewMigrationsRunOnceInOrderAndRollBackOnFailure(t *testing.T) {
	db := open(t)
	if err := Apply(db); err != nil {
		t.Fatal(err)
	}
	fsys := fstest.MapFS{
		"20270101-01-add-note.sql":  {Data: []byte(`ALTER TABLE clients ADD COLUMN "note" TEXT;`)},
		"20270102-01-fill-note.sql": {Data: []byte(`INSERT INTO clients ("name","shortName","note") VALUES ('A','A','hi');`)},
		"README.md":                 {Data: []byte("ignored")},
		"not-a-migration.sql":       {Data: []byte(`DROP TABLE clients;`)},
	}
	if err := ApplyFS(db, fsys); err != nil {
		t.Fatal(err)
	}
	if got := count(t, db, `SELECT COUNT(*) FROM clients WHERE "note" = 'hi'`); got != 1 {
		t.Errorf("migrations did not run in order: %d", got)
	}
	if got := count(t, db, `SELECT COUNT(*) FROM migrations WHERE "name" LIKE '2027%'`); got != 2 {
		t.Errorf("recorded: %d", got)
	}
	// A second run changes nothing.
	if err := ApplyFS(db, fsys); err != nil {
		t.Fatal(err)
	}
	if got := count(t, db, `SELECT COUNT(*) FROM clients`); got != 1 {
		t.Errorf("a migration ran twice: %d clients", got)
	}
	// A failing migration leaves no trace, not even earlier ones from the same run.
	bad := fstest.MapFS{
		"20270101-01-add-note.sql":  fsys["20270101-01-add-note.sql"],
		"20270102-01-fill-note.sql": fsys["20270102-01-fill-note.sql"],
		"20270201-01-ok.sql":        {Data: []byte(`ALTER TABLE clients ADD COLUMN "extra" TEXT;`)},
		"20270202-01-broken.sql":    {Data: []byte(`ALTER TABLE nope ADD COLUMN x TEXT;`)},
	}
	err := ApplyFS(db, bad)
	if err == nil || !strings.Contains(err.Error(), "20270202-01-broken.sql") {
		t.Fatalf("want the failing file named, got %v", err)
	}
	// (A double-quoted name that is not a column silently becomes a string in
	// SQLite, so ask the catalogue instead of selecting the column.)
	if got := count(t, db, `SELECT COUNT(*) FROM pragma_table_info('clients') WHERE name = 'extra'`); got != 0 {
		t.Error("the earlier migration of the failed run must be rolled back")
	}
	if got := count(t, db, `SELECT COUNT(*) FROM migrations WHERE "name" LIKE '20270201%'`); got != 0 {
		t.Error("a rolled back migration must not be recorded")
	}
}
