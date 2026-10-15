package backup

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// S3 is a minimal client for S3-compatible storage (AWS S3, MinIO, Backblaze B2, Cloudflare R2, Wasabi...):
// upload, list, download and delete, signed with AWS Signature Version 4.
type S3 struct {
	Endpoint  string // empty: AWS, https://s3.<region>.amazonaws.com
	Region    string
	Bucket    string
	Prefix    string
	AccessKey string
	SecretKey string
	PathStyle bool // bucket in the path (MinIO and most others) instead of the host name
	HTTP      *http.Client
	Now       func() time.Time
}

// Object is an item in a listing.
type Object struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified"`
}

func (c *S3) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 5 * time.Minute}
}

func (c *S3) now() time.Time {
	if c.Now != nil {
		return c.Now().UTC()
	}
	return time.Now().UTC()
}

func (c *S3) region() string {
	if c.Region == "" {
		return "us-east-1"
	}
	return c.Region
}

// target builds the URL for an object key ("" for the bucket itself).
func (c *S3) target(key string) (*url.URL, error) {
	base := c.Endpoint
	if base == "" {
		base = "https://s3." + c.region() + ".amazonaws.com"
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, fmt.Errorf("the S3 endpoint must be a full URL like https://s3.example.com")
	}
	if c.Bucket == "" {
		return nil, fmt.Errorf("the S3 bucket name is required")
	}
	path := "/" + key
	if c.PathStyle || c.Endpoint != "" && !strings.Contains(c.Endpoint, "amazonaws.com") {
		path = "/" + c.Bucket + path
	} else {
		u.Host = c.Bucket + "." + u.Host
	}
	u.Path, u.RawPath = path, uriEncode(path, true)
	return u, nil
}

func (c *S3) fullKey(name string) string {
	p := strings.Trim(c.Prefix, "/")
	if p == "" {
		return name
	}
	return p + "/" + name
}

func hmacSHA(key []byte, s string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(s))
	return m.Sum(nil)
}

func hexSHA(b []byte) string { s := sha256.Sum256(b); return hex.EncodeToString(s[:]) }

// uriEncode follows the AWS rules: unreserved characters stay, everything else is %XX; "/" stays in paths.
func uriEncode(s string, keepSlash bool) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= 'A' && ch <= 'Z', ch >= 'a' && ch <= 'z', ch >= '0' && ch <= '9', ch == '-', ch == '_', ch == '.', ch == '~':
			b.WriteByte(ch)
		case ch == '/' && keepSlash:
			b.WriteByte(ch)
		default:
			fmt.Fprintf(&b, "%%%02X", ch)
		}
	}
	return b.String()
}

// sign adds the x-amz-date, x-amz-content-sha256 and Authorization headers to req.
func (c *S3) sign(req *http.Request, body []byte) {
	t := c.now()
	amzDate := t.Format("20060102T150405Z")
	date := t.Format("20060102")
	payload := hexSHA(body)
	req.Header.Set("x-amz-date", amzDate)
	req.Header.Set("x-amz-content-sha256", payload)

	var names []string
	hdr := map[string]string{"host": req.URL.Host}
	names = append(names, "host")
	for k, v := range req.Header {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-amz-") || lk == "range" || lk == "content-type" {
			hdr[lk] = strings.TrimSpace(v[0])
			names = append(names, lk)
		}
	}
	sort.Strings(names)
	var canonHeaders strings.Builder
	for _, n := range names {
		canonHeaders.WriteString(n + ":" + hdr[n] + "\n")
	}
	signed := strings.Join(names, ";")

	q := req.URL.Query()
	var qs []string
	for k, vs := range q {
		for _, v := range vs {
			qs = append(qs, uriEncode(k, false)+"="+uriEncode(v, false))
		}
	}
	sort.Strings(qs)
	canonical := strings.Join([]string{req.Method, uriEncode(req.URL.Path, true), strings.Join(qs, "&"), canonHeaders.String(), signed, payload}, "\n")
	scope := date + "/" + c.region() + "/s3/aws4_request"
	toSign := "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hexSHA([]byte(canonical))
	k := hmacSHA([]byte("AWS4"+c.SecretKey), date)
	k = hmacSHA(k, c.region())
	k = hmacSHA(k, "s3")
	k = hmacSHA(k, "aws4_request")
	sig := hex.EncodeToString(hmacSHA(k, toSign))
	req.Header.Set("Authorization", fmt.Sprintf("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s", c.AccessKey, scope, signed, sig))
}

func (c *S3) do(ctx context.Context, method, key string, query url.Values, body []byte, ctype string) (*http.Response, error) {
	u, err := c.target(key)
	if err != nil {
		return nil, err
	}
	if query != nil {
		u.RawQuery = query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, u.String(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if ctype != "" {
		req.Header.Set("Content-Type", ctype)
	}
	c.sign(req, body)
	return c.client().Do(req)
}

func s3Error(resp *http.Response, what string) error {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	var e struct {
		Code    string `xml:"Code"`
		Message string `xml:"Message"`
	}
	if xml.Unmarshal(b, &e) == nil && e.Code != "" {
		return fmt.Errorf("%s: %s (%s)", what, e.Message, e.Code)
	}
	return fmt.Errorf("%s: the server answered %d", what, resp.StatusCode)
}

// Put uploads a file under the configured prefix.
func (c *S3) Put(ctx context.Context, name string, data []byte) error {
	resp, err := c.do(ctx, http.MethodPut, c.fullKey(name), nil, data, "application/octet-stream")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return s3Error(resp, "upload failed")
	}
	return nil
}

// Get downloads a file by its name under the prefix.
func (c *S3) Get(ctx context.Context, name string) ([]byte, error) {
	resp, err := c.do(ctx, http.MethodGet, c.fullKey(name), nil, nil, "")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, s3Error(resp, "download failed")
	}
	return io.ReadAll(io.LimitReader(resp.Body, 512<<20))
}

// Delete removes a file by its name under the prefix.
func (c *S3) Delete(ctx context.Context, name string) error {
	resp, err := c.do(ctx, http.MethodDelete, c.fullKey(name), nil, nil, "")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 && resp.StatusCode != http.StatusNotFound {
		return s3Error(resp, "delete failed")
	}
	return nil
}

// List returns the files under the prefix whose names start with namePrefix; Key is the name without the prefix.
func (c *S3) List(ctx context.Context, namePrefix string) ([]Object, error) {
	var out []Object
	token := ""
	for page := 0; page < 50; page++ {
		q := url.Values{"list-type": {"2"}, "prefix": {c.fullKey(namePrefix)}}
		if token != "" {
			q.Set("continuation-token", token)
		}
		resp, err := c.do(ctx, http.MethodGet, "", q, nil, "")
		if err != nil {
			return nil, err
		}
		if resp.StatusCode/100 != 2 {
			err := s3Error(resp, "listing failed")
			resp.Body.Close()
			return nil, err
		}
		var r struct {
			Contents []struct {
				Key          string    `xml:"Key"`
				Size         int64     `xml:"Size"`
				LastModified time.Time `xml:"LastModified"`
			} `xml:"Contents"`
			Truncated bool   `xml:"IsTruncated"`
			Next      string `xml:"NextContinuationToken"`
		}
		err = xml.NewDecoder(resp.Body).Decode(&r)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("listing failed: unreadable answer")
		}
		strip := ""
		if p := strings.Trim(c.Prefix, "/"); p != "" {
			strip = p + "/"
		}
		for _, o := range r.Contents {
			out = append(out, Object{Key: strings.TrimPrefix(o.Key, strip), Size: o.Size, LastModified: o.LastModified})
		}
		if !r.Truncated || r.Next == "" {
			break
		}
		token = r.Next
	}
	return out, nil
}
