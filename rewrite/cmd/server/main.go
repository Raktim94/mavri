// Command server runs the Mavri REST backend.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/api"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/sqlitestore"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	cfg := config.Load()

	// With no default database the server starts "not ready" and the auth
	// routes answer error.databaseNotInitialized until one is configured.
	var st store.Store
	if cfg.DefaultDB != "" {
		if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
			fmt.Fprintln(os.Stderr, "cannot create data directory:", err)
			os.Exit(1)
		}
		db, err := sqlitestore.Open(filepath.Join(cfg.DataDir, cfg.DefaultDB))
		if err != nil {
			fmt.Fprintln(os.Stderr, "cannot open database:", err)
			os.Exit(1)
		}
		defer db.Close()
		st = db
		log.Info("database ready", "file", cfg.DefaultDB)
	}

	srv := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Handler:           api.NewHandler(cfg, log, st, func(path string) (store.Store, error) { return sqlitestore.Open(path) }),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       5 * time.Minute, // large JSON imports
		WriteTimeout:      5 * time.Minute,
		IdleTimeout:       2 * time.Minute,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		log.Info("server listening", "addr", srv.Addr, "version", cfg.Version)
		errc <- srv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			fmt.Fprintln(os.Stderr, "server failed:", err)
			os.Exit(1)
		}
	case <-ctx.Done():
		log.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Error("graceful shutdown failed", "error", err)
			os.Exit(1)
		}
	}
}
