-- Mavri schema, first version. Money is stored as whole minor units
-- (cents) in INTEGER columns. Text columns are NOT NULL and use '' for "none";
-- only foreign keys may be NULL. Timestamps are UTC, ISO 8601.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner',
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT NOT NULL DEFAULT '',
  last_login_at TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE api_keys (
  id           INTEGER PRIMARY KEY,
  label        TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  secret_hash  TEXT NOT NULL UNIQUE,
  created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TEXT NOT NULL DEFAULT '',
  revoked_at   TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- People and companies: kind 'issuer' is who sends documents, 'customer' who receives them.
CREATE TABLE parties (
  id              INTEGER PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('issuer', 'customer')),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  tax_id          TEXT NOT NULL DEFAULT '',
  country         TEXT NOT NULL DEFAULT '',
  e_scheme        TEXT NOT NULL DEFAULT '',
  e_address       TEXT NOT NULL DEFAULT '',
  buyer_reference TEXT NOT NULL DEFAULT '',
  tax_exempt      INTEGER NOT NULL DEFAULT 0,
  note            TEXT NOT NULL DEFAULT '',
  logo            BLOB NOT NULL DEFAULT x'',
  logo_type       TEXT NOT NULL DEFAULT '',
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX parties_kind ON parties(kind);

CREATE TABLE currencies (
  id       INTEGER PRIMARY KEY,
  code     TEXT NOT NULL UNIQUE,
  symbol   TEXT NOT NULL,
  name     TEXT NOT NULL,
  pattern  TEXT NOT NULL DEFAULT '{symbol}{amount}',
  decimals INTEGER NOT NULL DEFAULT 2 CHECK (decimals BETWEEN 0 AND 4),
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bank_accounts (
  id             INTEGER PRIMARY KEY,
  label          TEXT NOT NULL UNIQUE,
  bank_name      TEXT NOT NULL DEFAULT '',
  holder         TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  swift          TEXT NOT NULL DEFAULT '',
  routing        TEXT NOT NULL DEFAULT '',
  branch         TEXT NOT NULL DEFAULT '',
  address        TEXT NOT NULL DEFAULT '',
  upi            TEXT NOT NULL DEFAULT '',
  qr_image       BLOB NOT NULL DEFAULT x'',
  qr_type        TEXT NOT NULL DEFAULT '',
  archived       INTEGER NOT NULL DEFAULT 0
);

-- Categories and units for catalog products.
CREATE TABLE catalog_groups (
  id       INTEGER PRIMARY KEY,
  kind     TEXT NOT NULL CHECK (kind IN ('category', 'unit')),
  name     TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, name)
);

CREATE TABLE products (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES catalog_groups(id) ON DELETE SET NULL,
  unit_id     INTEGER REFERENCES catalog_groups(id) ON DELETE SET NULL,
  archived    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE styles (
  id           INTEGER PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  accent       TEXT NOT NULL DEFAULT '#3b5bdb',
  font         TEXT NOT NULL DEFAULT 'sans',
  text_size    TEXT NOT NULL DEFAULT 'medium',
  logo_size    TEXT NOT NULL DEFAULT 'medium',
  page_size    TEXT NOT NULL DEFAULT 'A4',
  header_style TEXT NOT NULL DEFAULT 'light',
  row_style    TEXT NOT NULL DEFAULT 'plain',
  upper_labels INTEGER NOT NULL DEFAULT 0,
  show_numbers INTEGER NOT NULL DEFAULT 1,
  show_unit    INTEGER NOT NULL DEFAULT 1,
  show_qty     INTEGER NOT NULL DEFAULT 1,
  archived     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE presets (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  issuer_id     INTEGER NOT NULL REFERENCES parties(id),
  customer_id   INTEGER NOT NULL REFERENCES parties(id),
  currency_id   INTEGER NOT NULL REFERENCES currencies(id),
  bank_id       INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  style_id      INTEGER REFERENCES styles(id) ON DELETE SET NULL,
  note_customer TEXT NOT NULL DEFAULT '',
  note_terms    TEXT NOT NULL DEFAULT '',
  note_thanks   TEXT NOT NULL DEFAULT '',
  archived      INTEGER NOT NULL DEFAULT 0
);

-- Invoices and quotes. The *_snap columns hold JSON copies of the issuer,
-- customer, currency, bank account and style as they were when the document
-- was saved, so later edits to those records never change a sent document.
CREATE TABLE documents (
  id               INTEGER PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('invoice', 'quote')),
  number_prefix    TEXT NOT NULL DEFAULT '',
  number           TEXT NOT NULL,
  number_suffix    TEXT NOT NULL DEFAULT '',
  issuer_id        INTEGER NOT NULL REFERENCES parties(id),
  customer_id      INTEGER NOT NULL REFERENCES parties(id),
  currency_id      INTEGER NOT NULL REFERENCES currencies(id),
  bank_id          INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  style_id         INTEGER REFERENCES styles(id) ON DELETE SET NULL,
  converted_from   INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  issued_on        TEXT NOT NULL,
  due_on           TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL,
  discount_mode    TEXT NOT NULL DEFAULT '' CHECK (discount_mode IN ('', 'fixed', 'percent')),
  discount_cents   INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  discount_percent REAL NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  surcharge_mode    TEXT NOT NULL DEFAULT '' CHECK (surcharge_mode IN ('', 'fixed', 'percent')),
  surcharge_cents   INTEGER NOT NULL DEFAULT 0 CHECK (surcharge_cents >= 0),
  surcharge_percent REAL NOT NULL DEFAULT 0 CHECK (surcharge_percent BETWEEN 0 AND 100),
  shipping_cents   INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_rate         REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_mode         TEXT NOT NULL DEFAULT '' CHECK (tax_mode IN ('', 'add', 'included', 'withheld')),
  note_customer    TEXT NOT NULL DEFAULT '',
  note_terms       TEXT NOT NULL DEFAULT '',
  note_thanks      TEXT NOT NULL DEFAULT '',
  issuer_snap      TEXT NOT NULL DEFAULT '{}',
  customer_snap    TEXT NOT NULL DEFAULT '{}',
  currency_snap    TEXT NOT NULL DEFAULT '{}',
  bank_snap        TEXT NOT NULL DEFAULT '{}',
  style_snap       TEXT NOT NULL DEFAULT '{}',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (issuer_id, kind, number_prefix, number, number_suffix)
);
CREATE INDEX documents_kind_date ON documents(kind, issued_on);
CREATE INDEX documents_customer ON documents(customer_id);

CREATE TABLE document_lines (
  id          INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  unit        TEXT NOT NULL DEFAULT '',
  quantity    REAL NOT NULL DEFAULT 1,
  unit_cents  INTEGER NOT NULL DEFAULT 0,
  tax_rate    REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_mode    TEXT NOT NULL DEFAULT '' CHECK (tax_mode IN ('', 'add', 'included'))
);
CREATE INDEX document_lines_doc ON document_lines(document_id, position);

CREATE TABLE payments (
  id           INTEGER PRIMARY KEY,
  document_id  INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_on      TEXT NOT NULL,
  method       TEXT NOT NULL DEFAULT '',
  note         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX payments_doc ON payments(document_id);

CREATE TABLE attachments (
  id          INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  media_type  TEXT NOT NULL,
  data        BLOB NOT NULL
);

-- Online-store connections that turn paid orders into invoices.
CREATE TABLE shops (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'generic')),
  secret_sealed TEXT NOT NULL,
  issuer_id     INTEGER NOT NULL REFERENCES parties(id),
  currency_id   INTEGER NOT NULL REFERENCES currencies(id),
  bank_id       INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL,
  style_id      INTEGER REFERENCES styles(id) ON DELETE SET NULL,
  default_tax   REAL NOT NULL DEFAULT 0,
  mark_paid     INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  last_event_at TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE shop_orders (
  id          INTEGER PRIMARY KEY,
  shop_id     INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  received_at TEXT NOT NULL,
  UNIQUE (shop_id, external_id)
);

INSERT INTO currencies (code, symbol, name, pattern, decimals) VALUES
  ('USD', '$',   'US dollar',         '{symbol}{amount}',  2),
  ('EUR', '€',   'Euro',              '{amount} {symbol}', 2),
  ('GBP', '£',   'Pound sterling',    '{symbol}{amount}',  2),
  ('INR', '₹',   'Indian rupee',      '{symbol}{amount}',  2),
  ('JPY', '¥',   'Japanese yen',      '{symbol}{amount}',  0),
  ('CAD', 'CA$', 'Canadian dollar',   '{symbol}{amount}',  2),
  ('AUD', 'A$',  'Australian dollar', '{symbol}{amount}',  2),
  ('CHF', 'CHF', 'Swiss franc',       '{symbol} {amount}', 2),
  ('SEK', 'kr',  'Swedish krona',     '{amount} {symbol}', 2),
  ('NOK', 'kr',  'Norwegian krone',   '{amount} {symbol}', 2),
  ('DKK', 'kr',  'Danish krone',      '{amount} {symbol}', 2),
  ('PLN', 'zł',  'Polish złoty',      '{amount} {symbol}', 2),
  ('SGD', 'S$',  'Singapore dollar',  '{symbol}{amount}',  2),
  ('AED', 'AED', 'UAE dirham',        '{symbol} {amount}', 2),
  ('BRL', 'R$',  'Brazilian real',    '{symbol}{amount}',  2),
  ('MXN', 'MX$', 'Mexican peso',      '{symbol}{amount}',  2);
