// Command mavri runs the Mavri server: web app, REST API and webhooks.
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

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/web"
)

func main() {
	log, _ := web.WithErrorLog(slog.New(slog.NewJSONHandler(os.Stderr, nil)))
	cfg := web.ConfigFromEnv()
	if err := os.MkdirAll(cfg.DataDir, 0o700); err != nil {
		fatal("cannot create the data directory", err)
	}
	d, err := db.Open(filepath.Join(cfg.DataDir, cfg.Database))
	if err != nil {
		fatal("cannot open the database", err)
	}
	defer d.Close()
	box, err := shop.NewBox(cfg.DataDir, cfg.EncryptionKey)
	if err != nil {
		fatal("cannot set up encryption", err)
	}
	handler, app := web.Build(cfg, log, d, box)
	srv := &http.Server{
		Addr:              net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       2 * time.Minute,
		WriteTimeout:      2 * time.Minute,
		IdleTimeout:       2 * time.Minute,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	app.Start(ctx)
	errc := make(chan error, 1)
	go func() {
		log.Info("listening", "addr", srv.Addr, "version", web.Version, "database", cfg.Database)
		errc <- srv.ListenAndServe()
	}()
	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			fatal("server failed", err)
		}
	case <-ctx.Done():
		log.Info("shutting down")
		sctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := srv.Shutdown(sctx); err != nil {
			fatal("shutdown failed", err)
		}
	}
}

func fatal(msg string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", msg, err)
	os.Exit(1)
}
