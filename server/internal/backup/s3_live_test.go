package backup

import (
	"context"
	"net/http"
	"os"
	"testing"
)

// Runs against a real S3-compatible server when MAVRI_TEST_S3 is set, e.g.
// MAVRI_TEST_S3=http://127.0.0.1:8333 (SeaweedFS or MinIO) with the keys below.
func TestLiveS3(t *testing.T) {
	endpoint := os.Getenv("MAVRI_TEST_S3")
	if endpoint == "" {
		t.Skip("set MAVRI_TEST_S3 to run against a real server")
	}
	c := &S3{Endpoint: endpoint, Region: "us-east-1", Bucket: "mavri-test", Prefix: "nightly", AccessKey: "AKIAMAVRITEST", SecretKey: "mavri-test-secret-key", PathStyle: true}
	ctx := context.Background()
	// Create the bucket (idempotent) with a signed request.
	if resp, err := c.do(ctx, http.MethodPut, "", nil, nil, ""); err != nil {
		t.Fatal(err)
	} else {
		resp.Body.Close()
	}
	if err := c.Put(ctx, "mavri-backup-2026-10-01T030000Z.json.gz", []byte("hello")); err != nil {
		t.Fatalf("put: %v", err)
	}
	if err := c.Put(ctx, "mavri-backup-2026-10-02T030000Z.json.gz", []byte("world!")); err != nil {
		t.Fatalf("put 2: %v", err)
	}
	objs, err := c.List(ctx, "mavri-backup-")
	if err != nil || len(objs) != 2 || objs[0].Key != "mavri-backup-2026-10-01T030000Z.json.gz" || objs[1].Size != 6 {
		t.Fatalf("list: %+v %v", objs, err)
	}
	b, err := c.Get(ctx, "mavri-backup-2026-10-02T030000Z.json.gz")
	if err != nil || string(b) != "world!" {
		t.Fatalf("get: %q %v", b, err)
	}
	for _, o := range objs {
		if err := c.Delete(ctx, o.Key); err != nil {
			t.Fatalf("delete: %v", err)
		}
	}
	if objs, _ := c.List(ctx, "mavri-backup-"); len(objs) != 0 {
		t.Fatalf("left over: %+v", objs)
	}
	// A wrong secret is refused, not silently accepted.
	bad := *c
	bad.SecretKey = "wrong"
	if err := bad.Put(ctx, "x.txt", []byte("x")); err == nil {
		t.Fatal("a request signed with the wrong secret was accepted")
	}
}
