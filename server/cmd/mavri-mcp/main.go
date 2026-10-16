// Command mavri-mcp runs Mavri's MCP server on stdio for AI clients.
//
// It needs MAVRI_API_KEY (an API key made in Settings) and the same
// DB_DIRECTORY, DB_FILE and ENCRYPTION_KEY as the server.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/auth"
	"github.com/Raktim94/mavri/server/internal/automation"
	"github.com/Raktim94/mavri/server/internal/collections"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/mcp"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
	"github.com/Raktim94/mavri/server/internal/web"
)

func main() {
	cfg := web.ConfigFromEnv()
	d, err := db.Open(filepath.Join(cfg.DataDir, cfg.Database))
	if err != nil {
		fail("cannot open the database", err)
	}
	defer d.Close()
	if _, ok := (&auth.Service{DB: d}).VerifyKey(context.Background(), os.Getenv("MAVRI_API_KEY")); !ok {
		fail("MAVRI_API_KEY is missing or not a live API key", nil)
	}
	box, err := shop.NewBox(cfg.DataDir, cfg.EncryptionKey)
	if err != nil {
		fail("cannot set up encryption", err)
	}
	st := &store.Store{DB: d}
	hub := &activity.Hub{DB: d, Box: box}
	links := &share.Links{DB: d}
	ml := &mailer.Service{DB: d, Box: box, Store: st, Links: links, Hub: hub}
	auto := &automation.Service{DB: d, Store: st, Mail: ml, Hub: hub}
	auto.BaseURL = func(ctx context.Context) string {
		c, _ := auto.Load(ctx)
		return c.PublicURL
	}
	env := &mcp.Env{Store: st, Shops: &shop.Service{Store: st, Box: box}, Hub: hub, Auto: auto, Mail: ml, Links: links,
		Coll: &collections.Service{DB: d, Store: st, Hub: hub}}
	srv := mcp.NewServer("mavri", web.Version, mcp.Tools(env))
	// Everything this process changes is recorded as coming from an AI assistant over MCP.
	ctx := activity.WithSource(context.Background(), activity.SourceMCP, "MCP client")
	if err := srv.Serve(ctx, os.Stdin, os.Stdout); err != nil {
		fail("mcp server stopped", err)
	}
}

func fail(msg string, err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s: %v\n", msg, err)
	} else {
		fmt.Fprintln(os.Stderr, msg)
	}
	os.Exit(1)
}
