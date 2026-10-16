-- Collections: promises to pay, disputes and snoozes on an invoice, and the language an invoice is written in.
CREATE TABLE follow_ups (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('promise', 'dispute', 'snooze', 'note')),
  due_on       TEXT NOT NULL DEFAULT '',
  amount_cents INTEGER NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'ui',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at   TEXT NOT NULL,
  resolved_at  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX follow_ups_doc ON follow_ups(document_id, id);
CREATE INDEX follow_ups_open ON follow_ups(status, kind);

-- The language of the documents sent to this customer. Empty means the interface language.
ALTER TABLE parties ADD COLUMN language TEXT NOT NULL DEFAULT '';
