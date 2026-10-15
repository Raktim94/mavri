// Package db opens the SQLite database, applies migrations and offers a small
// reflection-based table helper so each record type needs no hand-written SQL.
package db

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Queryer is satisfied by *sql.DB and *sql.Tx.
type Queryer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Open opens (creating if needed) the database file and brings its schema up to date.
// Use ":memory:" for tests.
func Open(path string) (*sql.DB, error) {
	dsn := path
	if path != ":memory:" {
		dsn = "file:" + path + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)"
	} else {
		dsn = "file::memory:?_pragma=foreign_keys(1)"
	}
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// One connection: SQLite serialises writers anyway, and this keeps
	// transactions and the in-memory database simple and race free.
	d.SetMaxOpenConns(1)
	if err := Migrate(context.Background(), d); err != nil {
		d.Close()
		return nil, err
	}
	return d, nil
}

// Migrate applies every embedded migration that has not run yet, in file order.
func Migrate(ctx context.Context, d *sql.DB) error {
	if _, err := d.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`); err != nil {
		return err
	}
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, name := range names {
		var done int
		if err := d.QueryRowContext(ctx, `SELECT COUNT(*) FROM schema_migrations WHERE name = ?`, name).Scan(&done); err != nil {
			return err
		}
		if done > 0 {
			continue
		}
		body, err := migrationFiles.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		if err := WithTx(ctx, d, func(tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, string(body)); err != nil {
				return fmt.Errorf("migration %s: %w", name, err)
			}
			_, err := tx.ExecContext(ctx, `INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`, name, Now())
			return err
		}); err != nil {
			return err
		}
	}
	return nil
}

// WithTx runs fn in a transaction and commits if it returns nil.
func WithTx(ctx context.Context, d *sql.DB, fn func(tx *sql.Tx) error) error {
	tx, err := d.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// Now is the current UTC time in the format stored in the database.
func Now() string { return time.Now().UTC().Format(time.RFC3339) }

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("not found")

// ErrConflict is returned for unique or foreign-key violations.
var ErrConflict = errors.New("conflict")

// Classify maps SQLite constraint errors to ErrConflict so callers can answer 409.
func Classify(err error) error {
	if err == nil {
		return nil
	}
	m := err.Error()
	if strings.Contains(m, "constraint failed") || strings.Contains(m, "UNIQUE") || strings.Contains(m, "FOREIGN KEY") {
		return fmt.Errorf("%w: %s", ErrConflict, m)
	}
	return err
}
