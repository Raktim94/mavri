package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/einvoice"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Env is what the tools work on.
type Env struct {
	Store *store.Store
	Shops *shop.Service
}

// ---- schema helpers --------------------------------------------------------

type m = map[string]any

func str(desc string) m  { return m{"type": "string", "description": desc} }
func num(desc string) m  { return m{"type": "number", "description": desc} }
func intg(desc string) m { return m{"type": "integer", "description": desc, "minimum": float64(1)} }
func boolean(desc string) m {
	return m{"type": "boolean", "description": desc}
}
func oneOf(desc string, vals ...string) m {
	return m{"type": "string", "description": desc, "enum": vals}
}
func list(items m, desc string) m { return m{"type": "array", "items": items, "description": desc} }
func obj(props m, required ...string) m {
	s := m{"type": "object", "properties": props}
	if len(required) > 0 {
		s["required"] = required
	}
	return s
}

func decode(args map[string]any, into any) error {
	raw, _ := json.Marshal(args)
	return json.Unmarshal(raw, into)
}

func idArg(args map[string]any, name string) int64 {
	f, _ := args[name].(float64)
	return int64(f)
}

func strArg(args map[string]any, name string) string {
	s, _ := args[name].(string)
	return s
}

func notFound(what string, err error) error {
	if errors.Is(err, db.ErrNotFound) {
		return fmt.Errorf("%s not found", what)
	}
	return err
}

// ---- tools -----------------------------------------------------------------

// Tools returns every tool bound to env.
func Tools(env *Env) []Tool {
	s := env.Store
	var tools []Tool
	add := func(name, desc string, schema m, run func(ctx context.Context, a map[string]any) (any, error)) {
		tools = append(tools, Tool{Name: name, Description: desc, Schema: schema, Run: run})
	}

	// documents
	add("list_documents", "List invoices or quotes, newest first, with totals and paid amounts. Amounts are in minor units (cents).",
		obj(m{"kind": oneOf("invoice or quote", "invoice", "quote"), "status": str("unpaid, partial, paid, void, open, accepted or declined"),
			"query": str("part of the number or the customer's name"), "customerId": intg("only this customer"),
			"from": str("issued on or after, YYYY-MM-DD"), "to": str("issued on or before, YYYY-MM-DD"),
			"limit": intg("page size, default 50"), "offset": num("rows to skip")}),
		func(ctx context.Context, a map[string]any) (any, error) {
			limit := int(idArg(a, "limit"))
			if limit == 0 {
				limit = 50
			}
			if limit > 200 {
				limit = 200
			}
			items, total, err := s.ListDocuments(ctx, store.Filter{Kind: strArg(a, "kind"), Status: strArg(a, "status"), Query: strArg(a, "query"),
				CustomerID: idArg(a, "customerId"), From: strArg(a, "from"), To: strArg(a, "to"), Limit: limit, Offset: int(idArg(a, "offset"))})
			return m{"total": total, "items": items}, err
		})
	add("get_document", "Get one invoice or quote with its lines, payments, totals and the customer and issuer as they were saved.",
		obj(m{"id": intg("document id")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.GetDocument(ctx, s.DB, idArg(a, "id"))
			return d, notFound("document", err)
		})
	line := obj(m{"name": str("what is sold"), "quantity": num("how many, default 1"), "unitPrice": num("price per unit in major units, e.g. 12.50"),
		"unit": str("unit name such as hour or piece"), "taxRate": num("tax percent for this line"),
		"taxMode": oneOf("add puts tax on top, included means the price already has it", "add", "included")}, "name", "unitPrice")
	add("create_document", "Create an invoice or quote. Give the customer as an id, or as an object to find (by email) or create. Prices are in major units.",
		obj(m{"kind": oneOf("invoice or quote", "invoice", "quote"), "issuerId": intg("who issues it"),
			"customerId": intg("existing customer"), "customer": obj(m{"name": str("name"), "email": str("email"), "phone": str("phone"), "address": str("address"), "country": str("two-letter code")}, "name"),
			"currency": str("currency code such as USD, default USD"), "issuedOn": str("YYYY-MM-DD, default today"), "dueOn": str("YYYY-MM-DD"),
			"lines": list(line, "at least one"), "taxRate": num("tax percent for the whole document"),
			"taxMode": oneOf("how the document tax applies", "add", "included", "withheld"), "shipping": num("shipping in major units"),
			"discountPercent": num("percent discount"), "notes": str("note for the customer"), "bankId": intg("bank account to show")},
			"kind", "issuerId", "lines"),
		func(ctx context.Context, a map[string]any) (any, error) { return createDocument(ctx, env, a) })
	add("record_payment", "Record a payment against an invoice; the status updates by itself.",
		obj(m{"documentId": intg("invoice id"), "amount": num("amount in major units"), "paidOn": str("YYYY-MM-DD, default today"),
			"method": str("e.g. bank, cash, card"), "note": str("note")}, "documentId", "amount"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.GetDocument(ctx, s.DB, idArg(a, "documentId"))
			if err != nil {
				return nil, notFound("document", err)
			}
			amount, _ := a["amount"].(float64)
			paidOn := strArg(a, "paidOn")
			if paidOn == "" {
				paidOn = s.Today()
			}
			d.Payments = append(d.Payments, model.Payment{AmountCents: money.ToMinor(amount, d.Currency.Decimals), PaidOn: paidOn, Method: strArg(a, "method"), Note: strArg(a, "note")})
			return s.UpdateDocument(ctx, d.ID, d, store.SaveOptions{})
		})
	add("set_document_status", "Set a quote to open, accepted or declined, or void an invoice. Invoice paid and unpaid statuses follow payments.",
		obj(m{"id": intg("document id"), "status": oneOf("new status", "open", "accepted", "declined", "void", "unpaid")}, "id", "status"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.GetDocument(ctx, s.DB, idArg(a, "id"))
			if err != nil {
				return nil, notFound("document", err)
			}
			d.Status = strArg(a, "status")
			return s.UpdateDocument(ctx, d.ID, d, store.SaveOptions{})
		})
	add("duplicate_document", "Copy a document as a new one with the next number and today's date.", obj(m{"id": intg("document id")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.Duplicate(ctx, idArg(a, "id"))
			return d, notFound("document", err)
		})
	add("convert_quote", "Turn a quote into an invoice and mark the quote accepted.", obj(m{"id": intg("quote id")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.Convert(ctx, idArg(a, "id"))
			return d, notFound("quote", err)
		})
	add("delete_document", "Delete a document and its payments.", obj(m{"id": intg("document id")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			return m{"deleted": true}, notFound("document", s.DeleteDocument(ctx, idArg(a, "id")))
		})
	add("export_einvoice", "Make the UBL 2.1 or XRechnung XML of an invoice. Returns the XML text, or lists what is missing.",
		obj(m{"id": intg("invoice id"), "format": oneOf("e-invoice format, default ubl", "ubl", "xrechnung")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			d, err := s.GetDocument(ctx, s.DB, idArg(a, "id"))
			if err != nil {
				return nil, notFound("document", err)
			}
			format := strArg(a, "format")
			if format == "" {
				format = einvoice.UBL
			}
			x, err := einvoice.Generate(d, format)
			var problems einvoice.Problems
			if errors.As(err, &problems) {
				return nil, fmt.Errorf("not ready for e-invoicing: %s", strings.Join(problems, "; "))
			}
			return string(x), err
		})
	add("year_report", "Billed and paid totals by month and by customer for a year.", obj(m{"year": str("YYYY, default this year")}),
		func(ctx context.Context, a map[string]any) (any, error) {
			y := strArg(a, "year")
			if len(y) != 4 {
				y = s.Today()[:4]
			}
			return s.YearReport(ctx, y)
		})

	// customers and issuers
	partyTools := func(kind, plural string) {
		add("list_"+plural, "List "+plural+".", obj(m{"query": str("part of the name or email")}),
			func(ctx context.Context, a map[string]any) (any, error) {
				q := "%" + strings.ToLower(strArg(a, "query")) + "%"
				return store.Parties.Select(ctx, s.DB, "WHERE kind = ? AND (lower(name) LIKE ? OR lower(email) LIKE ?) ORDER BY name COLLATE NOCASE", kind, q, q)
			})
		fields := m{"name": str("name"), "email": str("email"), "phone": str("phone"), "address": str("address, street first, then postcode and city"),
			"taxId": str("tax or VAT id"), "country": str("two-letter country code"), "eScheme": str("e-invoice address scheme, e.g. 0204"),
			"eAddress": str("e-invoice address"), "buyerReference": str("buyer reference"), "note": str("private note")}
		add("create_"+kind, "Create a "+kind+".", obj(fields, "name"), func(ctx context.Context, a map[string]any) (any, error) {
			p := model.Party{Kind: kind}
			if err := decode(a, &p); err != nil {
				return nil, err
			}
			if err := store.CheckParty(&p); err != nil {
				return nil, err
			}
			return p, store.Parties.Insert(ctx, s.DB, &p)
		})
		upd := m{"id": intg("id")}
		for k, v := range fields {
			upd[k] = v
		}
		add("update_"+kind, "Change a "+kind+"; only the fields you give change.", obj(upd, "id"), func(ctx context.Context, a map[string]any) (any, error) {
			p, err := store.Parties.Get(ctx, s.DB, idArg(a, "id"))
			if err != nil || p.Kind != kind {
				return nil, fmt.Errorf("%s not found", kind)
			}
			if err := decode(a, &p); err != nil {
				return nil, err
			}
			p.ID, p.Kind = idArg(a, "id"), kind
			if err := store.CheckParty(&p); err != nil {
				return nil, err
			}
			return p, store.Parties.Update(ctx, s.DB, &p)
		})
		add("delete_"+kind, "Delete a "+kind+" that no document uses; archive it otherwise.", obj(m{"id": intg("id")}, "id"),
			func(ctx context.Context, a map[string]any) (any, error) {
				err := store.Parties.Delete(ctx, s.DB, idArg(a, "id"))
				if errors.Is(err, db.ErrConflict) {
					return nil, fmt.Errorf("this %s is used by documents; set archived instead", kind)
				}
				return m{"deleted": true}, notFound(kind, err)
			})
	}
	partyTools("customer", "customers")
	partyTools("issuer", "issuers")

	// products and currencies
	add("list_products", "List catalog products. priceCents is in hundredths.", obj(m{}), func(ctx context.Context, _ map[string]any) (any, error) {
		return store.Products.Select(ctx, s.DB, "ORDER BY name COLLATE NOCASE")
	})
	add("create_product", "Add a product to the catalog.", obj(m{"name": str("name"), "description": str("description"), "price": num("price in major units")}, "name"),
		func(ctx context.Context, a map[string]any) (any, error) {
			price, _ := a["price"].(float64)
			p := model.Product{Name: strArg(a, "name"), Description: strArg(a, "description"), PriceCents: money.ToMinor(price, 2)}
			if err := store.CheckProduct(&p); err != nil {
				return nil, err
			}
			return p, store.Products.Insert(ctx, s.DB, &p)
		})
	add("list_currencies", "List currencies.", obj(m{}), func(ctx context.Context, _ map[string]any) (any, error) {
		return store.Currencies.Select(ctx, s.DB, "ORDER BY code")
	})

	// stores
	add("list_shops", "List connected online stores.", obj(m{}), func(ctx context.Context, _ map[string]any) (any, error) {
		return env.Shops.List(ctx)
	})
	add("create_shop", "Connect an online store. The signing secret is returned once.",
		obj(m{"name": str("name"), "platform": oneOf("platform", "shopify", "woocommerce", "generic"), "issuerId": intg("issuer of the invoices"),
			"currency": str("currency code, default USD"), "bankId": intg("bank account"), "defaultTax": num("tax percent when an order has none"),
			"markPaid": boolean("record a payment when the store says the order is paid")}, "name", "platform", "issuerId"),
		func(ctx context.Context, a map[string]any) (any, error) {
			code := strings.ToUpper(strArg(a, "currency"))
			if code == "" {
				code = "USD"
			}
			cs, err := store.Currencies.Select(ctx, s.DB, "WHERE code = ?", code)
			if err != nil || len(cs) != 1 {
				return nil, fmt.Errorf("unknown currency %s", code)
			}
			sh := model.Shop{Name: strArg(a, "name"), Platform: strArg(a, "platform"), IssuerID: idArg(a, "issuerId"), CurrencyID: cs[0].ID}
			if b := idArg(a, "bankId"); b != 0 {
				sh.BankID = &b
			}
			sh.DefaultTax, _ = a["defaultTax"].(float64)
			sh.MarkPaid, _ = a["markPaid"].(bool)
			made, secret, err := env.Shops.Create(ctx, sh, 0)
			return m{"shop": made, "secret": secret}, err
		})
	add("pause_shop", "Stop a store connection from accepting orders.", obj(m{"id": intg("shop id")}, "id"),
		func(ctx context.Context, a map[string]any) (any, error) {
			return m{"paused": true}, notFound("shop", env.Shops.Pause(ctx, idArg(a, "id")))
		})
	add("create_invoice_from_order", "Turn a store order into an invoice, once per order id.",
		obj(m{"shopId": intg("store connection"), "orderId": str("the store's order id"), "customer": obj(m{"name": str("name"), "email": str("email"), "phone": str("phone"), "address": str("address"), "country": str("country code")}),
			"items":    list(obj(m{"name": str("name"), "quantity": num("quantity"), "unitPrice": num("price in major units")}, "name", "quantity", "unitPrice"), "order lines"),
			"shipping": num("shipping in major units"), "taxRate": num("tax percent"), "notes": str("note"), "paid": boolean("the order is already paid")},
			"shopId", "orderId", "items"),
		func(ctx context.Context, a map[string]any) (any, error) {
			sh, err := store.Shops.Get(ctx, s.DB, idArg(a, "shopId"))
			if err != nil {
				return nil, notFound("shop", err)
			}
			if !sh.Active {
				return nil, shop.ErrInactive
			}
			o := shop.Order{ExternalID: strArg(a, "orderId"), Notes: strArg(a, "notes")}
			o.Paid, _ = a["paid"].(bool)
			o.ShippingMajor, _ = a["shipping"].(float64)
			if r, ok := a["taxRate"].(float64); ok {
				o.TaxRatePercent = &r
			}
			if c, ok := a["customer"].(map[string]any); ok {
				o.Customer = shop.Customer{Name: strArg(c, "name"), Email: strArg(c, "email"), Phone: strArg(c, "phone"), Address: strArg(c, "address"), Country: strArg(c, "country")}
			}
			for _, it := range a["items"].([]any) {
				im := it.(map[string]any)
				q, _ := im["quantity"].(float64)
				p, _ := im["unitPrice"].(float64)
				o.Lines = append(o.Lines, shop.OrderLine{Name: strArg(im, "name"), Quantity: q, UnitPriceMajor: p})
			}
			id, dup, err := env.Shops.Ingest(ctx, sh, o)
			return m{"documentId": id, "duplicate": dup}, err
		})
	return tools
}

func createDocument(ctx context.Context, env *Env, a map[string]any) (any, error) {
	s := env.Store
	code := strings.ToUpper(strArg(a, "currency"))
	if code == "" {
		code = "USD"
	}
	cs, err := store.Currencies.Select(ctx, s.DB, "WHERE code = ?", code)
	if err != nil || len(cs) != 1 {
		return nil, fmt.Errorf("unknown currency %s", code)
	}
	cur := cs[0]
	d := model.Document{Kind: strArg(a, "kind"), IssuerID: idArg(a, "issuerId"), CustomerID: idArg(a, "customerId"), CurrencyID: cur.ID,
		IssuedOn: strArg(a, "issuedOn"), DueOn: strArg(a, "dueOn"), NoteCustomer: strArg(a, "notes"), TaxMode: strArg(a, "taxMode")}
	if d.IssuedOn == "" {
		d.IssuedOn = s.Today()
	}
	d.TaxRate, _ = a["taxRate"].(float64)
	if d.TaxRate > 0 && d.TaxMode == "" {
		d.TaxMode = "add"
	}
	if sh, ok := a["shipping"].(float64); ok {
		d.ShippingCents = money.ToMinor(sh, cur.Decimals)
	}
	if p, ok := a["discountPercent"].(float64); ok && p > 0 {
		d.Discount = model.Adjustment{Mode: "percent", Percent: p}
	}
	if b := idArg(a, "bankId"); b != 0 {
		d.BankID = &b
	}
	if d.CustomerID == 0 {
		c, ok := a["customer"].(map[string]any)
		if !ok {
			return nil, errors.New("give customerId or a customer object")
		}
		p := model.Party{Kind: "customer"}
		if err := decode(c, &p); err != nil {
			return nil, err
		}
		if p.Email != "" {
			if found, _ := store.Parties.Select(ctx, s.DB, "WHERE kind = 'customer' AND lower(email) = lower(?) LIMIT 1", p.Email); len(found) == 1 {
				p = found[0]
			}
		}
		if p.ID == 0 {
			if err := store.CheckParty(&p); err != nil {
				return nil, err
			}
			if err := store.Parties.Insert(ctx, s.DB, &p); err != nil {
				return nil, err
			}
		}
		d.CustomerID = p.ID
	}
	for _, raw := range a["lines"].([]any) {
		l := raw.(map[string]any)
		q := 1.0
		if v, ok := l["quantity"].(float64); ok {
			q = v
		}
		price, _ := l["unitPrice"].(float64)
		ln := model.Line{Name: strArg(l, "name"), Unit: strArg(l, "unit"), Quantity: q, UnitCents: money.ToMinor(price, cur.Decimals), TaxMode: strArg(l, "taxMode")}
		ln.TaxRate, _ = l["taxRate"].(float64)
		if ln.TaxRate > 0 && ln.TaxMode == "" {
			ln.TaxMode = "add"
		}
		d.Lines = append(d.Lines, ln)
	}
	return s.CreateDocument(ctx, d, store.SaveOptions{})
}
