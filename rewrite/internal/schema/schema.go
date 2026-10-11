// Package schema creates and checks the database layout. The layout is the
// one the TypeScript migrations produce; a fresh database gets it in one step
// from baseline.sql, and an existing database is only checked, never rewritten.
package schema

import (
	"database/sql"
	_ "embed"
	"fmt"
	"regexp"
	"strings"
)

//go:embed baseline.sql
var baseline string

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
// already has a migrations table must contain every baseline migration.
func Apply(db *sql.DB) error {
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
