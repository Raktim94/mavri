// Command mcp runs the Mavri MCP server on stdin/stdout. Nothing but protocol
// messages may be printed to stdout; logs go to stderr.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/auth"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/mcp"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/orders"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/secrets"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/sqlitestore"
)

func logf(format string, args ...any) { fmt.Fprintf(os.Stderr, "[nodedr-mcp] "+format+"\n", args...) }

func main() {
	key := os.Getenv("NODEDR_API_KEY")
	if key == "" {
		logf("NODEDR_API_KEY is not set. Create one via POST /api/auth/api-keys (requires a logged-in session) and set it in this process env.")
		os.Exit(1)
	}
	file := os.Getenv("DB_FILE")
	if file == "" {
		logf("DB_FILE is required (e.g. DB_FILE=invoice.db) — it must name an existing database file already created and opened via the app.")
		os.Exit(1)
	}
	cfg := config.Load()
	db, err := sqlitestore.OpenExisting(filepath.Join(cfg.DataDir, file))
	if err != nil {
		logf("%v", err)
		os.Exit(1)
	}
	defer db.Close()

	hash, err := auth.HashAPIKey(key)
	if err != nil {
		logf("%v", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	verified, err := db.ActiveAPIKeyByHash(ctx, hash, auth.FormatTimestamp(timeNow()))
	if err != nil || verified == nil || !auth.LooksLikeAPIKey(key) {
		logf("NODEDR_API_KEY is invalid or has been revoked.")
		os.Exit(1)
	}
	logf("Authenticated as API key %q.", verified.Name)

	repo := entity.Repo{DB: db.DB()}
	inv := &invoices.Service{Repo: repo}
	deps := mcp.Deps{Repo: repo, Invoices: inv,
		Orders: &orders.Service{Repo: repo, Invoices: inv, Box: &secrets.Box{Dir: cfg.DataDir, EnvKey: cfg.EncryptionKey}}}
	server := mcp.New("nodedr-invoice", "1.0.0", mcp.Tools(deps))
	logf("MCP server ready on stdio.")
	if err := server.Serve(ctx, os.Stdin, os.Stdout); err != nil {
		logf("%v", err)
		os.Exit(1)
	}
}

func timeNow() time.Time { return time.Now() }
