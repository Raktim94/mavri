package orders

import (
	"context"
	"database/sql"
	"errors"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
)

func keyOnly(err error) error { return &entity.Failure{Key: entity.MapError(err).Key} }

func nullable(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}

type rec map[string]any

// load reads one row of table by id into a map; nil when missing.
func (s *Service) load(ctx context.Context, table string, id int64) (rec, error) {
	rows, err := s.Repo.Select(ctx, table, `WHERE t."id" = ?`, id)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rec(rows[0]), nil
}

// findOrCreateClient matches a client by email (repeat customers) and
// otherwise creates one. An existing client is never changed by an order.
func (s *Service) findOrCreateClient(ctx context.Context, o Order) (int64, error) {
	if email, ok := o.Customer.Email.(string); ok && email != "" {
		var id int64
		err := s.Repo.DB.QueryRowContext(ctx, `SELECT "id" FROM clients WHERE "email" = ? AND "isArchived" = 0`, email).Scan(&id)
		if err == nil {
			return id, nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return 0, err
		}
	}
	name, ok := o.Customer.Name.(string)
	if !ok {
		return 0, &entity.Failure{Key: "error.unknownError"}
	}
	// A client's short name is at most two characters.
	short := name
	if r := []rune(name); len(r) > 2 {
		short = string(r[:2])
	}
	row, err := s.Repo.Save(ctx, entityClients, Row{"name": name, "shortName": short, "email": o.Customer.Email, "phone": o.Customer.Phone,
		"address": o.Customer.Address, "countryCode": o.Customer.CountryCode, "isArchived": false}, false)
	if err != nil {
		return 0, keyOnly(err)
	}
	if row == nil {
		return 0, &entity.Failure{Key: "error.unknownError"}
	}
	id, _ := row["id"].(int64)
	return id, nil
}

// findOrCreateItem matches a catalogue item by exact name and creates it
// otherwise, so an order never fails for want of a catalogue entry.
func (s *Service) findOrCreateItem(ctx context.Context, l Line) (int64, error) {
	name := str(l.Name)
	var id int64
	err := s.Repo.DB.QueryRowContext(ctx, `SELECT "id" FROM items WHERE "name" = ? AND "isArchived" = 0`, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return 0, err
	}
	row, err := s.Repo.Save(ctx, entityItems, Row{"name": name, "amount": str(l.UnitPriceMajor), "isArchived": false}, false)
	if err != nil {
		return 0, keyOnly(err)
	}
	if row == nil {
		return 0, &entity.Failure{Key: "error.unknownError"}
	}
	id, _ = row["id"].(int64)
	return id, nil
}

// CreateInvoice turns a verified order into an invoice and returns its id and
// number. It is the single path used by webhooks and by the public API.
func (s *Service) CreateInvoice(ctx context.Context, in *Integration, o Order) (int64, string, error) {
	business, err := s.load(ctx, "businesses", in.BusinessID)
	if err != nil {
		return 0, "", err
	}
	currency, err := s.load(ctx, "currencies", in.CurrencyID)
	if err != nil {
		return 0, "", err
	}
	var bank rec
	if in.BankID.Valid && in.BankID.Int64 != 0 {
		if bank, err = s.load(ctx, "banks", in.BankID.Int64); err != nil {
			return 0, "", err
		}
	}
	if business == nil {
		return 0, "", &entity.Failure{Key: "error.businessNotFound"}
	}
	if currency == nil {
		return 0, "", &entity.Failure{Key: "error.currencyNotFound"}
	}

	clientID, err := s.findOrCreateClient(ctx, o)
	if err != nil {
		return 0, "", err
	}
	client, err := s.load(ctx, "clients", clientID)
	if err != nil {
		return 0, "", err
	}

	subunit := num(firstDefined(currency["subunit"], 100))
	toMinor := func(major any) string { return numString(round(num(major) * subunit)) }

	var items []Row
	for _, l := range o.Lines {
		itemID, err := s.findOrCreateItem(ctx, l)
		if err != nil {
			return 0, "", err
		}
		items = append(items, Row{"itemId": itemID, "quantity": str(l.Quantity), "taxRate": in.DefaultTaxRate,
			"invoiceItemSnapshot": Row{"itemName": str(l.Name), "unitPriceCents": toMinor(l.UnitPriceMajor)}})
	}

	number := "1"
	if next, err := s.Invoices.NextSequence(ctx, in.BusinessID, clientID, "invoice"); err != nil {
		return 0, "", err
	} else if next != nil {
		number, _ = next["formattedSequence"].(string)
	}

	status := "unpaid"
	if in.AutoIssue {
		status = "open"
	}
	tax := any(in.DefaultTaxRate)
	if o.TaxRatePercent != nil {
		tax = num(o.TaxRatePercent)
	}
	opt := func(n sql.NullInt64) any {
		if n.Valid {
			return n.Int64
		}
		return nil
	}
	clientName := str(firstDefined(client["name"], o.Customer.Name))
	invoice := Row{
		"invoiceType": "invoice", "businessId": in.BusinessID, "clientId": clientID, "currencyId": in.CurrencyID,
		"bankId": opt(in.BankID), "layoutId": opt(in.LayoutID), "styleProfilesId": opt(in.StyleProfilesID),
		"issuedAt": s.now(), "invoiceNumber": number, "isArchived": false, "status": status, "customerNotes": o.Notes,
		"discountAmountCents": "0", "discountPercent": 0, "shippingFeeCents": toMinor(firstDefined(o.ShippingMajor, 0)),
		"surchargeAmountCents": "0", "surchargePercent": 0, "taxRate": tax, "language": "en",
		"invoiceItems":            items,
		"invoiceCurrencySnapshot": Row{"currencyCode": str(currency["code"]), "currencySymbol": str(currency["symbol"]), "currencySubunit": subunit},
		"invoiceBusinessSnapshot": Row{"businessName": str(business["name"]), "businessAddress": business["address"],
			"businessShortName": str(firstDefined(business["shortName"], business["name"])), "businessEmail": business["email"],
			"businessPhone": business["phone"], "businessVatCode": business["vatCode"], "businessCountryCode": business["countryCode"]},
		"invoiceClientSnapshot": Row{"clientName": clientName,
			"clientAddress":     firstDefined(client["address"], o.Customer.Address),
			"clientEmail":       firstDefined(client["email"], o.Customer.Email),
			"clientPhone":       firstDefined(client["phone"], o.Customer.Phone),
			"clientCountryCode": firstDefined(client["countryCode"], o.Customer.CountryCode)},
	}
	if bank != nil {
		invoice["invoiceBankSnapshot"] = Row{"name": str(bank["name"]), "bankName": bank["bankName"],
			"accountNumber": bank["accountNumber"], "swiftCode": bank["swiftCode"]}
	}
	res, err := s.Invoices.Add(ctx, invoice)
	if err != nil {
		return 0, "", err
	}
	created, ok := res.(Row)
	if !ok {
		return 0, "", &entity.Failure{Key: "error.unknownError"}
	}
	id, _ := created["id"].(int64)
	return id, number, nil
}
