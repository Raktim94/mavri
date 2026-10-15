package share

import (
	"context"
	"testing"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func TestLinkLifecycle(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	ctx := context.Background()
	st := &store.Store{DB: d}
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	cust := model.Party{Kind: "customer", Name: "You"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &cust)
	doc, err := st.CreateDocument(ctx, model.Document{Kind: "invoice", IssuerID: issuer.ID, CustomerID: cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
		Lines: []model.Line{{Name: "x", Quantity: 1, UnitCents: 100}}}, store.SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	l := &Links{DB: d}
	k, created, err := l.Ensure(ctx, doc.ID)
	if err != nil || !created || len(k.Token) < 30 {
		t.Fatalf("ensure: %+v %v %v", k, created, err)
	}
	k2, created, _ := l.Ensure(ctx, doc.ID)
	if created || k2.Token != k.Token {
		t.Fatal("a second Ensure must return the same link")
	}
	if id, err := l.Lookup(ctx, k.Token); err != nil || id != doc.ID {
		t.Fatalf("lookup: %d %v", id, err)
	}
	if _, err := l.Lookup(ctx, "short"); err != ErrGone {
		t.Fatal("a short token must not match")
	}
	if first, _ := l.Viewed(ctx, k.Token); !first {
		t.Fatal("first view")
	}
	if first, _ := l.Viewed(ctx, k.Token); first {
		t.Fatal("second view is not the first")
	}
	if cur, _, _ := l.Active(ctx, doc.ID); cur.Views != 2 {
		t.Fatalf("views: %d", cur.Views)
	}
	if err := l.Revoke(ctx, doc.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := l.Lookup(ctx, k.Token); err != ErrGone {
		t.Fatal("a revoked link must stop working")
	}
	k3, created, _ := l.Ensure(ctx, doc.ID)
	if !created || k3.Token == k.Token {
		t.Fatal("after revoking, a new link is a different token")
	}
}
