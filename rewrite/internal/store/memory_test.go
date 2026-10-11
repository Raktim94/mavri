package store_test

import (
	"testing"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/storetest"
)

func TestMemoryMeetsContract(t *testing.T) {
	storetest.Run(t, func(*testing.T) store.Store { return store.NewMemory() })
}
