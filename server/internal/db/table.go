package db

import (
	"context"
	"database/sql"
	"fmt"
	"reflect"
	"strings"
)

// Table gives CRUD for one record type. T is a struct whose fields carry
// `db:"column"` tags; the field tagged `db:"id"` is the integer primary key,
// and fields tagged `db:"-"` or without a tag are not stored.
type Table[T any] struct {
	Name    string
	cols    []string
	idx     []int // field index per column
	idCol   int
	created int // field index of created_at or -1
	updated int // field index of updated_at or -1
}

// NewTable inspects T once.
func NewTable[T any](name string) *Table[T] {
	t := &Table[T]{Name: name, idCol: -1, created: -1, updated: -1}
	typ := reflect.TypeFor[T]()
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("db")
		if tag == "" || tag == "-" {
			continue
		}
		if tag == "id" {
			t.idCol = len(t.cols)
		}
		if tag == "created_at" {
			t.created = i
		}
		if tag == "updated_at" {
			t.updated = i
		}
		t.cols = append(t.cols, tag)
		t.idx = append(t.idx, i)
	}
	if t.idCol < 0 {
		panic("db.NewTable: " + name + " has no db:\"id\" field")
	}
	return t
}

func (t *Table[T]) selectList() string { return strings.Join(t.cols, ", ") }

func (t *Table[T]) scanTargets(v *T) []any {
	rv := reflect.ValueOf(v).Elem()
	out := make([]any, len(t.idx))
	for i, fi := range t.idx {
		out[i] = rv.Field(fi).Addr().Interface()
	}
	return out
}

// Select returns rows matching the SQL after FROM table (e.g. "WHERE kind = ? ORDER BY name").
func (t *Table[T]) Select(ctx context.Context, q Queryer, tail string, args ...any) ([]T, error) {
	rows, err := q.QueryContext(ctx, "SELECT "+t.selectList()+" FROM "+t.Name+" "+tail, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		var v T
		if err := rows.Scan(t.scanTargets(&v)...); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// Get returns the row with this id, or ErrNotFound.
func (t *Table[T]) Get(ctx context.Context, q Queryer, id int64) (T, error) {
	var v T
	err := q.QueryRowContext(ctx, "SELECT "+t.selectList()+" FROM "+t.Name+" WHERE id = ?", id).Scan(t.scanTargets(&v)...)
	if err == sql.ErrNoRows {
		return v, ErrNotFound
	}
	return v, err
}

func (t *Table[T]) stamp(v *T, creating bool) {
	rv := reflect.ValueOf(v).Elem()
	if creating && t.created >= 0 {
		rv.Field(t.created).SetString(Now())
	}
	if t.updated >= 0 {
		rv.Field(t.updated).SetString(Now())
	}
}

func (t *Table[T]) values(v *T, skipID bool) (cols []string, vals []any) {
	rv := reflect.ValueOf(v).Elem()
	for i, c := range t.cols {
		if skipID && i == t.idCol {
			continue
		}
		cols = append(cols, c)
		val := rv.Field(t.idx[i]).Interface()
		if b, ok := val.([]byte); ok && b == nil {
			val = []byte{} // a nil slice would be bound as NULL
		}
		vals = append(vals, val)
	}
	return
}

// Insert adds the row and stores the new id in it.
func (t *Table[T]) Insert(ctx context.Context, q Queryer, v *T) error {
	t.stamp(v, true)
	cols, vals := t.values(v, true)
	res, err := q.ExecContext(ctx, fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", t.Name, strings.Join(cols, ", "),
		strings.TrimSuffix(strings.Repeat("?, ", len(cols)), ", ")), vals...)
	if err != nil {
		return Classify(err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	reflect.ValueOf(v).Elem().Field(t.idx[t.idCol]).SetInt(id)
	return nil
}

// Update rewrites every stored column of the row with the same id (created_at is kept).
func (t *Table[T]) Update(ctx context.Context, q Queryer, v *T) error {
	t.stamp(v, false)
	cols, vals := t.values(v, true)
	var set []string
	var args []any
	for i, c := range cols {
		if c == "created_at" {
			continue
		}
		set = append(set, c+" = ?")
		args = append(args, vals[i])
	}
	id := reflect.ValueOf(v).Elem().Field(t.idx[t.idCol]).Int()
	res, err := q.ExecContext(ctx, "UPDATE "+t.Name+" SET "+strings.Join(set, ", ")+" WHERE id = ?", append(args, id)...)
	if err != nil {
		return Classify(err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// Delete removes the row; a row that other records still use gives ErrConflict.
func (t *Table[T]) Delete(ctx context.Context, q Queryer, id int64) error {
	res, err := q.ExecContext(ctx, "DELETE FROM "+t.Name+" WHERE id = ?", id)
	if err != nil {
		return Classify(err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ID returns the primary key of a row.
func (t *Table[T]) ID(v *T) int64 { return reflect.ValueOf(v).Elem().Field(t.idx[t.idCol]).Int() }

// SetID sets the primary key of a row.
func (t *Table[T]) SetID(v *T, id int64) { reflect.ValueOf(v).Elem().Field(t.idx[t.idCol]).SetInt(id) }
