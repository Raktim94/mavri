-- The outcome of asking an official service whether a customer's tax number is active, with who answered and when.
CREATE TABLE tax_checks (
  id         INTEGER PRIMARY KEY,
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  tax_id     TEXT NOT NULL,
  result     TEXT NOT NULL CHECK (result IN ('valid', 'invalid', 'unavailable')),
  name       TEXT NOT NULL DEFAULT '',
  address    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL
);
CREATE INDEX tax_checks_party ON tax_checks(party_id, id);
