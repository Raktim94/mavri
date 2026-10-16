-- Document lifecycle, corrections and richer lines.
--
-- An invoice can be a draft, then issued (locked: its figures and details can no longer change; only payments
-- and voiding can). Mistakes are corrected with a credit note or a debit note that points at the original.
-- Existing documents keep working exactly as before: they are not locked and not drafts.

ALTER TABLE documents ADD COLUMN doc_type TEXT NOT NULL DEFAULT '' CHECK (doc_type IN ('', 'credit', 'debit'));
ALTER TABLE documents ADD COLUMN corrects INTEGER REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN issued_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN credited_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN supply_date TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN po_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN project_ref TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN settlement_currency TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN exchange_date TEXT NOT NULL DEFAULT '';
CREATE INDEX documents_corrects ON documents(corrects);

ALTER TABLE document_lines ADD COLUMN code TEXT NOT NULL DEFAULT '';
ALTER TABLE document_lines ADD COLUMN tax_code TEXT NOT NULL DEFAULT '';
ALTER TABLE document_lines ADD COLUMN period TEXT NOT NULL DEFAULT '';
ALTER TABLE document_lines ADD COLUMN line_type TEXT NOT NULL DEFAULT '';
ALTER TABLE document_lines ADD COLUMN tax_category TEXT NOT NULL DEFAULT '';

-- A refund is money paid back; it reduces what counts as received.
ALTER TABLE payments ADD COLUMN kind TEXT NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'refund'));

ALTER TABLE products ADD COLUMN sku TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN tax_code TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN barcode TEXT NOT NULL DEFAULT '';

ALTER TABLE parties ADD COLUMN payment_terms_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parties ADD COLUMN timezone TEXT NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN quiet_from TEXT NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN quiet_to TEXT NOT NULL DEFAULT '';
ALTER TABLE parties ADD COLUMN contact_preference TEXT NOT NULL DEFAULT '';
