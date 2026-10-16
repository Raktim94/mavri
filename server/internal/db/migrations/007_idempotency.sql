-- Replay-safe writes: a request sent with an Idempotency-Key header is carried out once; sending it again with
-- the same key returns the first answer.
CREATE TABLE idempotency_keys (
  key          TEXT NOT NULL,
  scope        TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status       INTEGER NOT NULL DEFAULT 0,
  body         BLOB NOT NULL DEFAULT x'',
  content_type TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  PRIMARY KEY (key, scope)
);
