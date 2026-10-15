package backup

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/shop"
)

func TestEncryptRoundTripAndWrongPassphrase(t *testing.T) {
	enc, err := Encrypt([]byte("secret data"), "correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if !IsEncrypted(enc) || bytes.Contains(enc, []byte("secret data")) {
		t.Fatal("not encrypted")
	}
	if p, err := Decrypt(enc, "correct horse"); err != nil || string(p) != "secret data" {
		t.Fatalf("decrypt: %q %v", p, err)
	}
	if _, err := Decrypt(enc, "wrong"); err != ErrPassphrase {
		t.Fatalf("wrong passphrase: %v", err)
	}
	if _, err := Decrypt(enc, ""); err != ErrPassphrase {
		t.Fatalf("no passphrase: %v", err)
	}
	enc[len(enc)-1] ^= 1 // tampering is detected, not silently accepted
	if _, err := Decrypt(enc, "correct horse"); err == nil {
		t.Fatal("a tampered file was accepted")
	}
}

func TestPackUnpack(t *testing.T) {
	src := seed(t)
	f, _ := Export(context.Background(), src.DB)
	for _, pass := range []string{"", "a good passphrase"} {
		data, err := Pack(f, pass)
		if err != nil {
			t.Fatal(err)
		}
		back, err := Unpack(data, pass)
		if err != nil {
			t.Fatalf("pass %q: %v", pass, err)
		}
		if Counts(back)["documents"] != 2 {
			t.Fatalf("counts: %v", Counts(back))
		}
	}
	if _, err := Unpack([]byte("garbage"), ""); err != ErrInvalid {
		t.Fatalf("garbage: %v", err)
	}
}

// The email and backup setup belong to the installation, not the business data.
func TestBackupLeavesInstallationSettingsAlone(t *testing.T) {
	src := seed(t)
	ctx := context.Background()
	src.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('app', '{"quotePrefix":"Q-"}'), ('mail', '{"host":"smtp.secret"}'), ('backup', '{"x":1}')`)
	f, _ := Export(ctx, src.DB)
	for _, row := range f.Tables["settings"] {
		if row["key"] != "app" {
			t.Fatalf("a backup must hold only the app settings, found %v", row["key"])
		}
	}
	dst, _ := db.Open(":memory:")
	defer dst.Close()
	dst.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('mail', '{"host":"keep.me"}')`)
	raw, _ := json.Marshal(f)
	parsed, err := Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err := Restore(ctx, dst, parsed); err != nil {
		t.Fatal(err)
	}
	var host string
	if err := dst.QueryRow(`SELECT value FROM settings WHERE key = 'mail'`).Scan(&host); err != nil || !strings.Contains(host, "keep.me") {
		t.Fatalf("restoring wiped the email setup: %q %v", host, err)
	}
}

// AWS's documented example for Signature Version 4 (GET Object with a Range header).
func TestSigV4MatchesTheAWSExample(t *testing.T) {
	c := &S3{Endpoint: "https://examplebucket.s3.amazonaws.com", Region: "us-east-1", Bucket: "examplebucket",
		AccessKey: "AKIAIOSFODNN7EXAMPLE", SecretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		Now: func() time.Time { return time.Date(2013, 5, 24, 0, 0, 0, 0, time.UTC) }}
	req, _ := http.NewRequest("GET", "https://examplebucket.s3.amazonaws.com/test.txt", nil)
	req.Header.Set("Range", "bytes=0-9")
	c.sign(req, nil)
	want := "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
	if got := req.Header.Get("Authorization"); got != want {
		t.Fatalf("authorization:\n got %s\nwant %s", got, want)
	}
}

// fakeS3 stores objects in memory and rejects requests that are not signed.
type fakeS3 struct {
	mu   sync.Mutex
	objs map[string][]byte
}

func (f *fakeS3) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if !strings.HasPrefix(r.Header.Get("Authorization"), "AWS4-HMAC-SHA256 Credential=AKID/") || r.Header.Get("x-amz-content-sha256") == "" {
		http.Error(w, `<Error><Code>AccessDenied</Code><Message>unsigned</Message></Error>`, 403)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/bucket/")
	switch {
	case r.Method == "PUT":
		b, _ := io.ReadAll(r.Body)
		f.objs[path] = b
	case r.Method == "DELETE":
		delete(f.objs, path)
		w.WriteHeader(204)
	case r.Method == "GET" && r.URL.Path == "/bucket/":
		prefix := r.URL.Query().Get("prefix")
		type item struct {
			Key          string
			Size         int
			LastModified string
		}
		var res struct {
			XMLName  xml.Name `xml:"ListBucketResult"`
			Contents []item   `xml:"Contents"`
		}
		var keys []string
		for k := range f.objs {
			if strings.HasPrefix(k, prefix) {
				keys = append(keys, k)
			}
		}
		sort.Strings(keys)
		for _, k := range keys {
			res.Contents = append(res.Contents, item{k, len(f.objs[k]), "2026-10-01T00:00:00.000Z"})
		}
		_ = xml.NewEncoder(w).Encode(res)
	case r.Method == "GET":
		b, ok := f.objs[path]
		if !ok {
			http.Error(w, `<Error><Code>NoSuchKey</Code><Message>missing</Message></Error>`, 404)
			return
		}
		_, _ = w.Write(b)
	}
}

func newService(t *testing.T) (*Service, *fakeS3, *time.Time) {
	t.Helper()
	src := seed(t)
	box, _ := shop.NewBox(t.TempDir(), "")
	now := time.Date(2026, 10, 1, 3, 0, 0, 0, time.UTC)
	fs := &fakeS3{objs: map[string][]byte{}}
	srv := httptest.NewServer(fs)
	t.Cleanup(srv.Close)
	s := &Service{DB: src.DB, Box: box, Dir: filepath.Join(t.TempDir(), "backups"), Hub: &activity.Hub{DB: src.DB, Box: box}, Now: func() time.Time { return now }}
	s.S3Client = func(c S3Config, secret string) *S3 {
		return &S3{Endpoint: srv.URL, Region: "us-east-1", Bucket: "bucket", Prefix: c.Prefix, AccessKey: c.AccessKey, SecretKey: secret, PathStyle: true,
			Now: func() time.Time { return now }}
	}
	return s, fs, &now
}

func TestScheduledBackupWritesVerifiesAndPrunes(t *testing.T) {
	s, fs, now := newService(t)
	ctx := context.Background()
	err := s.Save(ctx, Config{Enabled: true, EveryHours: 24, Keep: 2, Encrypt: true, Passphrase: "long enough pass",
		S3: S3Config{Enabled: true, Bucket: "bucket", AccessKey: "AKID", SecretKey: "sekret", Prefix: "nightly"}})
	if err != nil {
		t.Fatal(err)
	}
	if cfg, _ := s.Load(ctx); cfg.Passphrase != "" || cfg.S3.SecretKey != "" || !cfg.PassphraseSet || !cfg.S3.SecretKeySet {
		t.Fatalf("secrets must not be returned: %+v", cfg)
	}
	for i := 0; i < 3; i++ {
		if err := s.RunDue(ctx); err != nil {
			t.Fatalf("run %d: %v", i, err)
		}
		*now = now.Add(25 * time.Hour)
	}
	files, _ := s.LocalFiles()
	if len(files) != 2 || !files[0].Encrypted {
		t.Fatalf("retention should keep 2 encrypted copies: %+v", files)
	}
	if len(fs.objs) != 2 {
		t.Fatalf("S3 retention: %d objects", len(fs.objs))
	}
	for k := range fs.objs {
		if !strings.HasPrefix(k, "nightly/mavri-backup-") {
			t.Fatalf("object key %q ignores the prefix", k)
		}
	}
	// The local copy opens with the saved passphrase and holds the data.
	raw, _ := s.ReadLocal(files[0].Name)
	f, err := Unpack(raw, "long enough pass")
	if err != nil || Counts(f)["documents"] != 2 {
		t.Fatalf("unpack: %v %v", err, Counts(f))
	}
	if _, err := Unpack(raw, "wrong passphrase"); err != ErrPassphrase {
		t.Fatalf("wrong passphrase: %v", err)
	}
	// And the same copy can be fetched back from the bucket.
	got, err := s.ReadS3(ctx, files[0].Name)
	if err != nil || !bytes.Equal(got, raw) {
		t.Fatalf("s3 copy differs: %v", err)
	}
	st, _ := s.Status(ctx)
	if st.LastSuccess == nil || st.AgeHours < 0 || st.AgeHours > 30 || len(st.Included) == 0 || len(st.Excluded) == 0 {
		t.Fatalf("status: %+v", st)
	}
	if err := s.TestS3(ctx); err != nil {
		t.Fatalf("connection test: %v", err)
	}
}

func TestBackupIsNotRepeatedBeforeItIsDue(t *testing.T) {
	s, _, now := newService(t)
	ctx := context.Background()
	s.Save(ctx, Config{Enabled: true, EveryHours: 24, Keep: 5})
	s.RunDue(ctx)
	*now = now.Add(2 * time.Hour)
	s.RunDue(ctx)
	if files, _ := s.LocalFiles(); len(files) != 1 {
		t.Fatalf("a second backup was taken after 2 hours: %d", len(files))
	}
}

func TestFailedS3UploadIsRecordedAndLocalCopyKept(t *testing.T) {
	s, _, _ := newService(t)
	ctx := context.Background()
	s.Save(ctx, Config{Enabled: true, EveryHours: 24, Keep: 5, S3: S3Config{Enabled: true, Bucket: "bucket", AccessKey: "WRONG", SecretKey: "x"}})
	s.S3Client = func(c S3Config, secret string) *S3 { // an endpoint that is not listening
		return &S3{Endpoint: "http://127.0.0.1:1", Bucket: "bucket", AccessKey: "AKID", SecretKey: "x", PathStyle: true}
	}
	if _, err := s.RunNow(ctx); err == nil || !strings.Contains(err.Error(), "S3") {
		t.Fatalf("expected an S3 error, got %v", err)
	}
	st, _ := s.Status(ctx)
	if st.LastFailure == nil || st.LastFailure.Target != "s3" || len(st.Files) != 1 {
		t.Fatalf("status after a failed upload: %+v", st)
	}
}

func TestConfigValidationAndNames(t *testing.T) {
	s, _, _ := newService(t)
	ctx := context.Background()
	for name, c := range map[string]Config{
		"interval":      {EveryHours: 0, Keep: 3},
		"keep":          {EveryHours: 24, Keep: 0},
		"short pass":    {EveryHours: 24, Keep: 3, Passphrase: "short"},
		"encrypt none":  {EveryHours: 24, Keep: 3, Encrypt: true},
		"s3 incomplete": {EveryHours: 24, Keep: 3, S3: S3Config{Enabled: true}},
		"s3 endpoint":   {EveryHours: 24, Keep: 3, S3: S3Config{Enabled: true, Bucket: "b", AccessKey: "a", SecretKey: "s", Endpoint: "ftp://x"}},
	} {
		if err := s.Save(ctx, c); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
	for _, bad := range []string{"../etc/passwd", "mavri-backup-x.json.gz", "mavri-backup-2026-10-01T030000Z.json.gz/../../x"} {
		if ValidName(bad) {
			t.Errorf("%q passed as a backup name", bad)
		}
		if _, err := s.ReadLocal(bad); err == nil {
			t.Errorf("read %q", bad)
		}
	}
	if !ValidName("mavri-backup-2026-10-01T030000Z.json.gz.enc") {
		t.Fatal("a real name was rejected")
	}
	if _, err := os.Stat(s.Dir); err == nil {
		t.Fatal("validation must not create files")
	}
}
