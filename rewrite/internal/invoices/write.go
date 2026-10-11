package invoices

import (
	"context"
	"database/sql"
	"strings"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
)

// setPaidAndClosed stamps paidAt or closedAt according to the status.
func (s *Service) setPaidAndClosed(data Row) {
	now := s.now().UTC().Format("2006-01-02T15:04:05.000Z")
	switch asString(data["status"]) {
	case "paid":
		data["paidAt"], data["closedAt"] = now, nil
	case "closed":
		data["closedAt"], data["paidAt"] = now, nil
	default:
		data["paidAt"], data["closedAt"] = nil, nil
	}
}

func isSet(row Row, key string) bool { return row[key] != nil }

// write is Repo.Write bound to a transaction, with the parent id filled in.
func (s *Service) write(ctx context.Context, tx *sql.Tx, spec *entity.Spec, row Row, parentKey string, parentID int64, update, batch bool) (int64, error) {
	r := clone(row)
	if parentKey != "" {
		r[parentKey] = parentID
	}
	return s.Repo.Write(ctx, tx, spec, r, update, batch)
}

// snapshots writes the snapshot rows of an invoice. On update, a snapshot
// with an id is updated in place; one without is inserted.
func (s *Service) snapshots(ctx context.Context, tx *sql.Tx, data Row, id int64, update bool) error {
	type step struct {
		spec  *entity.Spec
		row   Row
		gate  bool
		batch bool
	}
	cust := withDecoded(data, "invoiceCustomization")
	client := child(data, "invoiceClientSnapshot")
	if client != nil {
		client = clone(client)
		if client["clientTaxExempt"] == nil {
			client["clientTaxExempt"] = false
		}
	}
	business := withDecoded(data, "invoiceBusinessSnapshot")
	bank := withDecoded(data, "invoiceBankSnapshot")
	steps := []step{
		{styleSnap, child(data, "invoiceStyleProfileSnapshot"), isSet(data, "styleProfilesId"), false},
		{customization, cust, true, false},
		{currencySnap, child(data, "invoiceCurrencySnapshot"), isSet(data, "currencyId"), false},
		{bankSnap, bank, isSet(data, "bankId"), false},
		{businessSnap, business, isSet(data, "businessId"), false},
	}
	if update {
		steps = append(steps, step{clientSnap, client, isSet(data, "clientId"), false}, step{layoutSnap, child(data, "invoiceLayoutSnapshot"), isSet(data, "layoutId"), true})
	} else {
		steps = append(steps, step{layoutSnap, child(data, "invoiceLayoutSnapshot"), isSet(data, "layoutId"), true}, step{clientSnap, client, isSet(data, "clientId"), false})
	}
	for _, st := range steps {
		if !st.gate || st.row == nil {
			if update && st.spec == bankSnap && data["bankId"] == nil {
				// The bank was cleared from the invoice: drop its stale snapshot.
				if _, err := tx.ExecContext(ctx, `DELETE FROM invoice_bank_snapshots WHERE "parentInvoiceId" = ?`, id); err != nil {
					return err
				}
			}
			continue
		}
		_, hasID := st.row["id"]
		hasID = hasID && st.row["id"] != nil
		if _, err := s.write(ctx, tx, st.spec, st.row, "parentInvoiceId", id, update && hasID, st.batch); err != nil {
			return err
		}
	}
	return nil
}

// lines replaces the line items (and their price snapshots) of an invoice.
func (s *Service) lines(ctx context.Context, tx *sql.Tx, id int64, items []Row) error {
	for _, item := range items {
		it := clone(item)
		if raw, ok := it["customField"].(entity.RawJSON); ok {
			switch strings.TrimSpace(string(raw)) {
			case "null", "false", "0", `""`:
				delete(it, "customField") // falsy values were stored as NULL
			}
		}
		itemID, err := s.write(ctx, tx, lineItem, it, "parentInvoiceId", id, false, false)
		if err != nil {
			return err
		}
		if snap := child(item, "invoiceItemSnapshot"); itemID != 0 && snap != nil {
			if _, err := s.write(ctx, tx, itemSnap, snap, "parentInvoiceItemId", itemID, false, false); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *Service) payments(ctx context.Context, tx *sql.Tx, id int64, pays []Row) error {
	for _, p := range pays {
		if pid, ok := asInt(p["id"]); ok && pid != 0 {
			var one int
			err := tx.QueryRowContext(ctx, `SELECT 1 FROM invoice_payments WHERE "id" = ?`, pid).Scan(&one)
			if err == nil {
				r := clone(p)
				r["id"] = pid
				if _, err := s.write(ctx, tx, payment, r, "parentInvoiceId", id, true, false); err != nil {
					return err
				}
				continue
			} else if err != sql.ErrNoRows {
				return err
			}
		}
		if _, err := s.write(ctx, tx, payment, p, "parentInvoiceId", id, false, false); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) attachments(ctx context.Context, tx *sql.Tx, id int64, atts []Row) error {
	for _, a := range atts {
		if _, err := s.write(ctx, tx, attachment, a, "parentInvoiceId", id, false, false); err != nil {
			return err
		}
	}
	return nil
}

// Add saves a new invoice with everything attached, in one transaction, and
// advances the numbering for its client and business.
func (s *Service) Add(ctx context.Context, data Row) (any, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	s.setPaidAndClosed(data)
	id, err := s.Repo.Write(ctx, tx, invoice, data, false, false)
	if err != nil {
		return nil, keyOnly(err)
	}
	if err := s.snapshots(ctx, tx, data, id, false); err != nil {
		return nil, err
	}
	if err := s.lines(ctx, tx, id, children(data, "invoiceItems")); err != nil {
		return nil, err
	}
	if err := s.payments(ctx, tx, id, children(data, "invoicePayments")); err != nil {
		return nil, err
	}
	if err := s.attachments(ctx, tx, id, children(data, "invoiceAttachments")); err != nil {
		return nil, err
	}
	result, err := s.one(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	businessID, _ := asInt(data["businessId"])
	clientID, _ := asInt(data["clientId"])
	if err := s.processSequence(ctx, tx, businessID, clientID, asString(data["invoiceNumber"]), asString(data["invoiceType"])); err != nil {
		return nil, &entity.Failure{}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}

// Update replaces an invoice and everything attached to it.
func (s *Service) Update(ctx context.Context, data Row) (any, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id, hasID := asInt(data["id"])
	var prevNumber sql.NullString
	var prevClient, prevBusiness int64
	if hasID {
		err = tx.QueryRowContext(ctx, `SELECT "invoiceNumber","clientId","businessId" FROM invoices WHERE "id" = ?`, id).Scan(&prevNumber, &prevClient, &prevBusiness)
	} else {
		err = sql.ErrNoRows
	}
	if err == sql.ErrNoRows {
		return nil, notFound()
	}
	if err != nil {
		return nil, err
	}

	s.setPaidAndClosed(data)
	if _, err := s.Repo.Write(ctx, tx, invoice, data, true, false); err != nil {
		return nil, keyOnly(err)
	}
	if err := s.snapshots(ctx, tx, data, id, true); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM invoice_items WHERE "parentInvoiceId" = ?`, id); err != nil {
		return nil, err
	}
	if err := s.lines(ctx, tx, id, children(data, "invoiceItems")); err != nil {
		return nil, err
	}
	pays := children(data, "invoicePayments")
	var keep []any
	for _, p := range pays {
		if pid, ok := asInt(p["id"]); ok && pid != 0 {
			keep = append(keep, pid)
		}
	}
	if len(keep) > 0 {
		args := append([]any{id}, keep...)
		if _, err := tx.ExecContext(ctx, `DELETE FROM invoice_payments WHERE "parentInvoiceId" = ? AND "id" NOT IN (`+placeholders(len(keep))+`)`, args...); err != nil {
			return nil, err
		}
	} else if _, err := tx.ExecContext(ctx, `DELETE FROM invoice_payments WHERE "parentInvoiceId" = ?`, id); err != nil {
		return nil, err
	}
	if err := s.payments(ctx, tx, id, pays); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM attachments WHERE "parentInvoiceId" = ?`, id); err != nil {
		return nil, err
	}
	if err := s.attachments(ctx, tx, id, children(data, "invoiceAttachments")); err != nil {
		return nil, err
	}
	result, err := s.one(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	businessID, _ := asInt(data["businessId"])
	clientID, _ := asInt(data["clientId"])
	if err := s.processSequenceOnUpdate(ctx, tx, prevNumber.String, prevClient, prevBusiness,
		asString(data["invoiceNumber"]), clientID, businessID, asString(data["invoiceType"])); err != nil {
		return nil, &entity.Failure{}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return result, nil
}
