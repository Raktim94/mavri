package sqlitestore

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/storetest"
)

func TestSQLiteMeetsContract(t *testing.T) {
	storetest.Run(t, func(t *testing.T) store.Store {
		s, err := Open(filepath.Join(t.TempDir(), "t.db"))
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { s.Close() })
		return s
	})
}

func TestDataSurvivesReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "t.db")
	s, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateUser(context.Background(), "o@example.com", "h", "owner"); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if n, _ := s.CountUsers(context.Background()); n != 1 {
		t.Errorf("users after reopen: %d", n)
	}
}
