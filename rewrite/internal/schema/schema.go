// Package schema creates and checks the database layout. The layout is the
// one the TypeScript migrations produce; a fresh database gets it in one step
// from baseline.sql, and an existing database is only checked, never rewritten.
package schema

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"
)

//go:embed baseline.sql
var baseline string

// migrationFiles holds the schema changes made since the baseline, one SQL
// file each, named like the TypeScript ones: YYYYMMDD-NN-description.sql.
//
//go:embed migrations
var migrationFiles embed.FS

var migrationRow = regexp.MustCompile(`INSERT OR IGNORE INTO "migrations" VALUES\('([^']+)'`)

// stem drops the extension: the TypeScript runner records ".cjs" in builds
// and ".ts" in development, and both mean the same migration.
func stem(name string) string {
	if i := strings.LastIndex(name, "."); i > 0 {
		return name[:i]
	}
	return name
}

// BaselineMigrations lists the migrations the baseline already contains.
func BaselineMigrations() []string {
	var out []string
	for _, m := range migrationRow.FindAllStringSubmatch(baseline, -1) {
		out = append(out, stem(m[1]))
	}
	return out
}

// Apply prepares db: an empty database gets the baseline; a database that
// already has a migrations table must contain every baseline migration. Then
// any newer migration is applied.
func Apply(db *sql.DB) error {
	sub, err := fs.Sub(migrationFiles, "migrations")
	if err != nil {
		return err
	}
	return ApplyFS(db, sub)
}

var migrationName = regexp.MustCompile(`^\d{8}-\d{2}-.+\.sql$`)

// ApplyFS is Apply with the post-baseline migrations taken from fsys.
func ApplyFS(db *sql.DB, fsys fs.FS) error {
	if err := applyBaseline(db); err != nil {
		return err
	}
	return runMigrations(db, fsys)
}

// runMigrations applies, in file-name order, the migrations not yet recorded.
// They run in one transaction with foreign keys off (table rebuilds need that),
// so a failure leaves the database as it was.
func runMigrations(db *sql.DB, fsys fs.FS) error {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && migrationName.MatchString(e.Name()) {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	applied := map[string]bool{}
	rows, err := db.Query(`SELECT "name" FROM migrations`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return err
		}
		applied[stem(n)] = true
	}
	rows.Close()
	var pending []string
	for _, n := range names {
		if !applied[stem(n)] {
			pending = append(pending, n)
		}
	}
	if len(pending) == 0 {
		return nil
	}
	if _, err := db.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	defer db.Exec(`PRAGMA foreign_keys = ON`)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, n := range pending {
		body, err := fs.ReadFile(fsys, n)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(string(body)); err != nil {
			return fmt.Errorf("schema: migration %s: %w", n, err)
		}
		if _, err := tx.Exec(`INSERT INTO migrations ("name") VALUES (?)`, n); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func applyBaseline(db *sql.DB) error {
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='migrations'`).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		if _, err := db.Exec(baseline); err != nil {
			return fmt.Errorf("schema: apply baseline: %w", err)
		}
		return nil
	}
	rows, err := db.Query(`SELECT "name" FROM migrations`)
	if err != nil {
		return err
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return err
		}
		have[stem(name)] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, want := range BaselineMigrations() {
		if !have[want] {
			return fmt.Errorf("schema: database is missing migration %s; start the TypeScript server once to upgrade it", want)
		}
	}
	return nil
}
