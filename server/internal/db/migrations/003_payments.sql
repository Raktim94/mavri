-- Online payments: each gateway event is applied once.
CREATE TABLE gateway_events (
  id          INTEGER PRIMARY KEY,
  event_id    TEXT NOT NULL UNIQUE,
  provider    TEXT NOT NULL,
  type        TEXT NOT NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  outcome     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
