package backup

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/shop"
)

// ErrInvalidSetting is a problem with the backup settings the caller sent.
var ErrInvalidSetting = errors.New("invalid backup setting")

// S3Config is where copies are uploaded.
type S3Config struct {
	Enabled      bool   `json:"enabled"`
	Endpoint     string `json:"endpoint"`
	Region       string `json:"region"`
	Bucket       string `json:"bucket"`
	Prefix       string `json:"prefix"`
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey,omitempty"`
	SecretKeySet bool   `json:"secretKeySet"`
	PathStyle    bool   `json:"pathStyle"`

	secretSealed string
}

// Config is the backup schedule and destinations.
type Config struct {
	Enabled       bool     `json:"enabled"`
	EveryHours    int      `json:"everyHours"`
	Keep          int      `json:"keep"` // newest copies kept per destination
	Encrypt       bool     `json:"encrypt"`
	Passphrase    string   `json:"passphrase,omitempty"`
	PassphraseSet bool     `json:"passphraseSet"`
	S3            S3Config `json:"s3"`

	passSealed string
}

// Run is one attempt, shown in the history.
type Run struct {
	ID     int64  `json:"id"`
	At     string `json:"at"`
	Target string `json:"target"`
	OK     bool   `json:"ok"`
	Name   string `json:"name"`
	Bytes  int64  `json:"bytes"`
	Error  string `json:"error"`
}

// FileInfo is a copy kept on this server.
type FileInfo struct {
	Name      string `json:"name"`
	Bytes     int64  `json:"bytes"`
	At        string `json:"at"`
	Encrypted bool   `json:"encrypted"`
}

// Status summarises the state of backups for the screen and the health page.
type Status struct {
	Config        Config     `json:"config"`
	LastSuccess   *Run       `json:"lastSuccess"`
	LastFailure   *Run       `json:"lastFailure"`
	AgeHours      float64    `json:"ageHours"` // since the last success, -1 if none
	Runs          []Run      `json:"runs"`
	Files         []FileInfo `json:"files"`
	Included      []string   `json:"included"`
	Excluded      []string   `json:"excluded"`
	EncryptionKey string     `json:"encryptionNote"`
}

// Service runs and records backups.
type Service struct {
	DB  *sql.DB
	Box *shop.Box
	Dir string // where local copies are kept
	Hub *activity.Hub
	Now func() time.Time
	// HTTPS lets tests point S3 at a local server.
	S3Client func(c S3Config, secret string) *S3
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

type stored struct {
	Config
	PassSealed string `json:"passSealed"`
	SecretSeal string `json:"secretSealed"`
}

// Load returns the saved configuration with secrets removed.
func (s *Service) Load(ctx context.Context) (Config, error) {
	cfg := Config{EveryHours: 24, Keep: 7}
	var raw string
	err := s.DB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'backup'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	st := stored{Config: cfg}
	if json.Unmarshal([]byte(raw), &st) != nil {
		return cfg, nil
	}
	c := st.Config
	c.passSealed, c.S3.secretSealed = st.PassSealed, st.SecretSeal
	c.PassphraseSet, c.S3.SecretKeySet = st.PassSealed != "", st.SecretSeal != ""
	c.Passphrase, c.S3.SecretKey = "", ""
	return c, nil
}

// Save validates and stores the configuration. Empty secrets keep the saved ones.
func (s *Service) Save(ctx context.Context, in Config) error {
	old, err := s.Load(ctx)
	if err != nil {
		return err
	}
	bad := func(format string, a ...any) error {
		return fmt.Errorf("%w: %s", ErrInvalidSetting, fmt.Sprintf(format, a...))
	}
	if in.EveryHours < 1 || in.EveryHours > 24*31 {
		return bad("back up every 1 to 744 hours")
	}
	if in.Keep < 1 || in.Keep > 365 {
		return bad("keep between 1 and 365 copies")
	}
	pass, sec := old.passSealed, old.S3.secretSealed
	if in.Passphrase != "" {
		if len(in.Passphrase) < 8 {
			return bad("the passphrase needs at least 8 characters")
		}
		if pass, err = s.Box.Seal(in.Passphrase); err != nil {
			return err
		}
	}
	if in.Encrypt && pass == "" {
		return bad("enter a passphrase to encrypt backups")
	}
	if in.S3.SecretKey != "" {
		if sec, err = s.Box.Seal(in.S3.SecretKey); err != nil {
			return err
		}
	}
	in.S3.Endpoint, in.S3.Bucket = strings.TrimSpace(in.S3.Endpoint), strings.TrimSpace(in.S3.Bucket)
	if in.S3.Enabled {
		if in.S3.Bucket == "" || in.S3.AccessKey == "" || sec == "" {
			return bad("S3 needs a bucket, an access key and a secret key")
		}
		if in.S3.Endpoint != "" && !strings.HasPrefix(in.S3.Endpoint, "http://") && !strings.HasPrefix(in.S3.Endpoint, "https://") {
			return bad("the S3 endpoint must start with https:// (or http:// for a server on your own network)")
		}
	}
	raw, _ := json.Marshal(stored{Config: in, PassSealed: pass, SecretSeal: sec})
	_, err = s.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('backup', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return err
}

func (s *Service) secrets(cfg Config) (pass, secret string) {
	if cfg.passSealed != "" {
		pass, _ = s.Box.Open(cfg.passSealed)
	}
	if cfg.S3.secretSealed != "" {
		secret, _ = s.Box.Open(cfg.S3.secretSealed)
	}
	return
}

func (s *Service) s3(cfg Config, secret string) *S3 {
	if s.S3Client != nil {
		return s.S3Client(cfg.S3, secret)
	}
	return &S3{Endpoint: cfg.S3.Endpoint, Region: cfg.S3.Region, Bucket: cfg.S3.Bucket, Prefix: cfg.S3.Prefix,
		AccessKey: cfg.S3.AccessKey, SecretKey: secret, PathStyle: cfg.S3.PathStyle}
}

var fileName = regexp.MustCompile(`^mavri-backup-\d{4}-\d{2}-\d{2}T\d{6}Z\.json\.gz(\.enc)?$`)

// ValidName reports whether name is a backup file name Mavri would have made.
func ValidName(name string) bool { return fileName.MatchString(name) }

func (s *Service) record(ctx context.Context, target string, ok bool, name string, n int, errText string) {
	_, _ = s.DB.ExecContext(ctx, `INSERT INTO backup_runs (at, target, ok, name, bytes, error) VALUES (?, ?, ?, ?, ?, ?)`,
		s.now().Format(time.RFC3339), target, b2i(ok), name, n, errText)
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// RunNow takes a backup: it writes a local copy, uploads to S3 if switched on, checks the copy can be read
// back, and removes copies beyond the retention. It returns the file name and any per-destination errors.
func (s *Service) RunNow(ctx context.Context) (name string, err error) {
	cfg, err := s.Load(ctx)
	if err != nil {
		return "", err
	}
	pass, secret := s.secrets(cfg)
	if cfg.Encrypt && pass == "" {
		return "", errors.New("encryption is on but the passphrase cannot be read")
	}
	f, err := Export(ctx, s.DB)
	if err != nil {
		s.fail(ctx, "local", "", err)
		return "", err
	}
	use := ""
	if cfg.Encrypt {
		use = pass
	}
	data, err := Pack(f, use)
	if err != nil {
		s.fail(ctx, "local", "", err)
		return "", err
	}
	// Recovery check: the bytes we are about to keep must open and hold what was exported.
	back, err := Unpack(data, use)
	if err != nil || fmt.Sprint(Counts(back)) != fmt.Sprint(Counts(f)) {
		err = errors.New("the new backup could not be read back correctly; it was discarded")
		s.fail(ctx, "local", "", err)
		return "", err
	}
	name = "mavri-backup-" + s.now().Format("2006-01-02T150405Z") + ".json.gz"
	if cfg.Encrypt {
		name += ".enc"
	}
	var problems []string
	if err := s.writeLocal(name, data); err != nil {
		s.fail(ctx, "local", name, err)
		problems = append(problems, "local: "+err.Error())
	} else {
		s.record(ctx, "local", true, name, len(data), "")
		s.pruneLocal(cfg.Keep)
	}
	if cfg.S3.Enabled {
		cl := s.s3(cfg, secret)
		if err := cl.Put(ctx, name, data); err != nil {
			s.fail(ctx, "s3", name, err)
			problems = append(problems, "S3: "+err.Error())
		} else {
			s.record(ctx, "s3", true, name, len(data), "")
			s.pruneS3(ctx, cl, cfg.Keep)
		}
	}
	if len(problems) > 0 {
		return name, errors.New(strings.Join(problems, "; "))
	}
	s.Hub.Record(ctx, activity.Event{Action: "completed", Entity: "backup", Label: name, Detail: fmt.Sprintf("%d bytes", len(data)), Name: "backup.completed",
		Data: map[string]any{"name": name, "bytes": len(data), "encrypted": cfg.Encrypt, "s3": cfg.S3.Enabled}})
	return name, nil
}

func (s *Service) fail(ctx context.Context, target, name string, err error) {
	s.record(ctx, target, false, name, 0, err.Error())
	s.Hub.Record(ctx, activity.Event{Action: "failed", Entity: "backup", Label: name, Detail: target + ": " + err.Error(), Name: "backup.failed",
		Data: map[string]any{"target": target, "error": err.Error()}})
}

func (s *Service) writeLocal(name string, data []byte) error {
	if err := os.MkdirAll(s.Dir, 0o700); err != nil {
		return err
	}
	tmp := filepath.Join(s.Dir, "."+name+".part")
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(s.Dir, name))
}

func (s *Service) pruneLocal(keep int) {
	files, _ := s.LocalFiles()
	for i := keep; i < len(files); i++ {
		_ = os.Remove(filepath.Join(s.Dir, files[i].Name))
	}
}

func (s *Service) pruneS3(ctx context.Context, cl *S3, keep int) {
	objs, err := cl.List(ctx, "mavri-backup-")
	if err != nil {
		return
	}
	var names []string
	for _, o := range objs {
		if ValidName(o.Key) {
			names = append(names, o.Key)
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(names))) // names sort by time
	for i := keep; i < len(names); i++ {
		_ = cl.Delete(ctx, names[i])
	}
}

// LocalFiles lists the copies kept on this server, newest first.
func (s *Service) LocalFiles() ([]FileInfo, error) {
	ents, err := os.ReadDir(s.Dir)
	if errors.Is(err, os.ErrNotExist) {
		return []FileInfo{}, nil
	}
	if err != nil {
		return nil, err
	}
	out := []FileInfo{}
	for _, e := range ents {
		if !ValidName(e.Name()) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		out = append(out, FileInfo{Name: e.Name(), Bytes: info.Size(), At: info.ModTime().UTC().Format(time.RFC3339), Encrypted: strings.HasSuffix(e.Name(), ".enc")})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name > out[j].Name })
	return out, nil
}

// ReadLocal returns a copy kept on this server.
func (s *Service) ReadLocal(name string) ([]byte, error) {
	if !ValidName(name) {
		return nil, ErrInvalid
	}
	return os.ReadFile(filepath.Join(s.Dir, name))
}

// ReadS3 downloads a copy from the configured bucket.
func (s *Service) ReadS3(ctx context.Context, name string) ([]byte, error) {
	if !ValidName(name) {
		return nil, ErrInvalid
	}
	cfg, err := s.Load(ctx)
	if err != nil {
		return nil, err
	}
	if !cfg.S3.Enabled {
		return nil, errors.New("S3 is not set up")
	}
	_, secret := s.secrets(cfg)
	return s.s3(cfg, secret).Get(ctx, name)
}

// ListS3 lists the copies in the bucket, newest first.
func (s *Service) ListS3(ctx context.Context) ([]FileInfo, error) {
	cfg, err := s.Load(ctx)
	if err != nil || !cfg.S3.Enabled {
		return []FileInfo{}, err
	}
	_, secret := s.secrets(cfg)
	objs, err := s.s3(cfg, secret).List(ctx, "mavri-backup-")
	if err != nil {
		return nil, err
	}
	out := []FileInfo{}
	for _, o := range objs {
		if ValidName(o.Key) {
			out = append(out, FileInfo{Name: o.Key, Bytes: o.Size, At: o.LastModified.UTC().Format(time.RFC3339), Encrypted: strings.HasSuffix(o.Key, ".enc")})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name > out[j].Name })
	return out, nil
}

// TestS3 checks the destination: it can be listed and a small file can be written and deleted.
func (s *Service) TestS3(ctx context.Context) error {
	cfg, err := s.Load(ctx)
	if err != nil {
		return err
	}
	if !cfg.S3.Enabled {
		return errors.New("switch S3 on and save first")
	}
	_, secret := s.secrets(cfg)
	cl := s.s3(cfg, secret)
	name := "mavri-connection-test.txt"
	if err := cl.Put(ctx, name, []byte("Mavri connection test "+s.now().Format(time.RFC3339))); err != nil {
		return err
	}
	return cl.Delete(ctx, name)
}

// Passphrase returns the saved passphrase, for restoring a backup the server made itself.
func (s *Service) Passphrase(ctx context.Context) string {
	cfg, err := s.Load(ctx)
	if err != nil {
		return ""
	}
	p, _ := s.secrets(cfg)
	return p
}

// Status gathers everything the backup screen shows.
func (s *Service) Status(ctx context.Context) (Status, error) {
	cfg, err := s.Load(ctx)
	if err != nil {
		return Status{}, err
	}
	st := Status{Config: cfg, AgeHours: -1, Included: Included, Excluded: Excluded, Runs: []Run{},
		EncryptionKey: "Backups never contain the server's encryption key. Keep your passphrase safe: without it an encrypted backup cannot be opened."}
	rows, err := s.DB.QueryContext(ctx, `SELECT id, at, target, ok, name, bytes, error FROM backup_runs ORDER BY id DESC LIMIT 30`)
	if err != nil {
		return st, err
	}
	defer rows.Close()
	for rows.Next() {
		var r Run
		var ok int
		if err := rows.Scan(&r.ID, &r.At, &r.Target, &ok, &r.Name, &r.Bytes, &r.Error); err != nil {
			return st, err
		}
		r.OK = ok == 1
		st.Runs = append(st.Runs, r)
	}
	for i := range st.Runs {
		r := st.Runs[i]
		if r.OK && st.LastSuccess == nil {
			st.LastSuccess = &r
		}
		if !r.OK && st.LastFailure == nil {
			st.LastFailure = &r
		}
	}
	if st.LastSuccess != nil {
		if t, err := time.Parse(time.RFC3339, st.LastSuccess.At); err == nil {
			st.AgeHours = s.now().Sub(t).Hours()
		}
	}
	st.Files, err = s.LocalFiles()
	return st, err
}

// RunDue takes a backup if backups are on and the last success is older than the interval.
func (s *Service) RunDue(ctx context.Context) error {
	cfg, err := s.Load(ctx)
	if err != nil || !cfg.Enabled {
		return err
	}
	var last string
	_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(at), '') FROM backup_runs WHERE ok = 1`).Scan(&last)
	if t, err := time.Parse(time.RFC3339, last); err == nil && s.now().Sub(t) < time.Duration(cfg.EveryHours)*time.Hour {
		return nil
	}
	// Do not hammer a failing destination: wait an hour after a failed attempt.
	var failed string
	_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(at), '') FROM backup_runs WHERE ok = 0`).Scan(&failed)
	if t, err := time.Parse(time.RFC3339, failed); err == nil && s.now().Sub(t) < time.Hour && failed > last {
		return nil
	}
	_, err = s.RunNow(activity.WithSource(ctx, activity.SourceSystem, "scheduled backup"))
	return err
}

// Run checks every minute whether a backup is due, until ctx ends.
func (s *Service) Run(ctx context.Context, log func(msg string, args ...any)) {
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		if err := s.RunDue(ctx); err != nil {
			log("scheduled backup failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}
