-- Sharing, activity history, webhooks, email, recurring invoices and backup runs.

ALTER TABLE parties ADD COLUMN no_reminders INTEGER NOT NULL DEFAULT 0;

-- Who did what. `source` is where the change came from: ui, api, mcp, public, webhook or system.
CREATE TABLE audit_log (
  id        INTEGER PRIMARY KEY,
  at        TEXT NOT NULL,
  actor     TEXT NOT NULL DEFAULT '',
  source    TEXT NOT NULL,
  action    TEXT NOT NULL,
  entity    TEXT NOT NULL,
  entity_id INTEGER NOT NULL DEFAULT 0,
  label     TEXT NOT NULL DEFAULT '',
  detail    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log(at);
CREATE INDEX audit_log_entity ON audit_log(entity, entity_id);

-- Secure client links: an unguessable token opens a read-only view of one document.
CREATE TABLE share_links (
  id              INTEGER PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  created_at      TEXT NOT NULL,
  revoked_at      TEXT NOT NULL DEFAULT '',
  first_viewed_at TEXT NOT NULL DEFAULT '',
  last_viewed_at  TEXT NOT NULL DEFAULT '',
  views           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX share_links_doc ON share_links(document_id);

CREATE TABLE webhook_endpoints (
  id            INTEGER PRIMARY KEY,
  url           TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  secret_sealed TEXT NOT NULL,
  events        TEXT NOT NULL DEFAULT '*',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE webhook_deliveries (
  id              INTEGER PRIMARY KEY,
  endpoint_id     INTEGER NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event           TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  response_code   INTEGER NOT NULL DEFAULT 0,
  response_body   TEXT NOT NULL DEFAULT '',
  error           TEXT NOT NULL DEFAULT '',
  next_attempt_at TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  delivered_at    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX webhook_deliveries_due ON webhook_deliveries(status, next_attempt_at);
CREATE INDEX webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, id);

-- Every email Mavri tried to send. reminder_key keeps a reminder from going out twice.
CREATE TABLE mail_log (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL,
  to_addr      TEXT NOT NULL,
  subject      TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error        TEXT NOT NULL DEFAULT '',
  reminder_key TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);
CREATE INDEX mail_log_doc ON mail_log(document_id, id);
CREATE UNIQUE INDEX mail_log_reminder ON mail_log(reminder_key) WHERE reminder_key <> '' AND status = 'sent';

-- A recurring invoice repeats the stored document on a schedule.
CREATE TABLE recurring (
  id             INTEGER PRIMARY KEY,
  document_id    INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  every          TEXT NOT NULL CHECK (every IN ('week', 'month', 'quarter', 'year')),
  interval_n     INTEGER NOT NULL DEFAULT 1 CHECK (interval_n >= 1),
  start_on       TEXT NOT NULL,
  next_on        TEXT NOT NULL,
  end_on         TEXT NOT NULL DEFAULT '',
  active         INTEGER NOT NULL DEFAULT 1,
  auto_send      INTEGER NOT NULL DEFAULT 0,
  last_issued_on TEXT NOT NULL DEFAULT '',
  issued_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

CREATE TABLE backup_runs (
  id     INTEGER PRIMARY KEY,
  at     TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('local', 's3')),
  ok     INTEGER NOT NULL,
  name   TEXT NOT NULL DEFAULT '',
  bytes  INTEGER NOT NULL DEFAULT 0,
  error  TEXT NOT NULL DEFAULT ''
);
