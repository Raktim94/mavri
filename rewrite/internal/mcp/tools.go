package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/jsnum"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/orders"
)

// Deps are the services the tools work with.
type Deps struct {
	Repo     entity.Repo
	Invoices *invoices.Service
	Orders   *orders.Service
}

// ---- argument helpers (zod-style defaults live here) ------------------------------

func has(a obj, k string) bool { return a[k] != nil }

func strArg(a obj, k string) any {
	if s, ok := a[k].(string); ok {
		return s
	}
	return nil
}

func numArg(a obj, k string) float64 {
	n, _ := a[k].(json.Number)
	f, _ := n.Float64()
	return f
}

func intArg(a obj, k string) int64 { return int64(numArg(a, k)) }

func boolArg(a obj, k string, def bool) bool {
	if b, ok := a[k].(bool); ok {
		return b
	}
	return def
}

func numOr(a obj, k string, def float64) float64 {
	if has(a, k) {
		return numArg(a, k)
	}
	return def
}

func strOr(a obj, k, def string) string {
	if s, ok := a[k].(string); ok {
		return s
	}
	return def
}

func keyOf(err error) error { return errors.New(entity.MapError(err).Key) }

func rowToJSON(r entity.Row) any {
	if r == nil {
		return nil
	}
	return r
}

var (
	clientKeys = []string{"name", "shortName", "email", "phone", "address", "code", "vatCode", "countryCode", "taxExempt", "taxExemptionCertificate"}
	itemKeys   = []string{"name", "amount", "unitId", "categoryId", "description"}
	statuses   = []string{"open", "unpaid", "closed", "partially", "paid"}
)

func clientFields(withID bool) []Field {
	var f []Field
	if withID {
		f = append(f, Required("id", Number()))
	}
	f = append(f, Required("name", String()), Required("shortName", MaxLen(2)), Optional("email", String()), Optional("phone", String()),
		Optional("address", String()), Optional("code", String()), Optional("vatCode", String()), Optional("countryCode", String()),
		Optional("taxExempt", With(Boolean(), false)), Optional("taxExemptionCertificate", String()))
	if withID {
		f = append(f, Optional("isArchived", With(Boolean(), false)))
	}
	return f
}

func pick(a obj, keys []string) entity.Row {
	row := entity.Row{}
	for _, k := range keys {
		if has(a, k) {
			row[k] = a[k]
		}
	}
	return row
}

// Tools returns the 20 tools, in the order they were always listed.
func Tools(d Deps) []Tool {
	clientRow := func(a obj) entity.Row {
		row := pick(a, clientKeys)
		row["taxExempt"] = boolArg(a, "taxExempt", false)
		return row
	}
	itemRow := func(a obj) entity.Row { return pick(a, itemKeys) }

	return []Tool{
		{"list_clients", "List clients", "List all customers/clients, including their invoice counts and tax-exemption status.",
			Input(Optional("includeArchived", With(Boolean(), false))),
			func(ctx context.Context, a obj) (any, error) {
				rows, err := d.Repo.List(ctx, entity.Clients, nil)
				if err != nil {
					return nil, keyOf(err)
				}
				if boolArg(a, "includeArchived", false) {
					return rows, nil
				}
				out := []entity.Row{}
				for _, r := range rows {
					if r["isArchived"] != true {
						out = append(out, r)
					}
				}
				return out, nil
			}},
		{"get_client", "Get client", "Get a single client by id.", Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				rows, err := d.Repo.Select(ctx, "clients", `WHERE t."id" = ?`, intArg(a, "id"))
				if err != nil {
					return nil, keyOf(err)
				}
				if len(rows) == 0 {
					return nil, errors.New("error.clientNotFound")
				}
				return rows[0], nil
			}},
		{"create_client", "Create client", "Create a new client/customer. shortName must be 2 characters or fewer.",
			Input(clientFields(false)...),
			func(ctx context.Context, a obj) (any, error) {
				row := clientRow(a)
				row["isArchived"] = false
				saved, err := d.Repo.Save(ctx, entity.Clients, row, false)
				if err != nil {
					return nil, keyOf(err)
				}
				return rowToJSON(saved), nil
			}},
		{"update_client", "Update client",
			"Update an existing client. Only provided fields are meaningful; omit fields you do not want to change from what create_client/get_client returned.",
			Input(clientFields(true)...),
			func(ctx context.Context, a obj) (any, error) {
				row := clientRow(a)
				row["id"] = a["id"]
				row["isArchived"] = boolArg(a, "isArchived", false)
				saved, err := d.Repo.Save(ctx, entity.Clients, row, true)
				if err != nil {
					return nil, keyOf(err)
				}
				return rowToJSON(saved), nil
			}},
		{"delete_client", "Delete client", "Permanently delete a client. Fails if the client has invoices referencing it.",
			Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				if err := d.Repo.Delete(ctx, entity.Clients, intArg(a, "id")); err != nil {
					return nil, keyOf(err)
				}
				return obj{"success": true}, nil
			}},
		{"list_items", "List items/products", "List all products/items available to add to invoices, with their unit price in cents.",
			Input(),
			func(ctx context.Context, _ obj) (any, error) {
				rows, err := d.Repo.List(ctx, entity.Items, nil)
				if err != nil {
					return nil, keyOf(err)
				}
				return rows, nil
			}},
		{"create_item", "Create item/product",
			`Create a new product/item. amount is the unit price in cents, as a string (e.g. "1999" = $19.99).`,
			Input(Required("name", String()), Required("amount", String()), Optional("unitId", Number()), Optional("categoryId", Number()), Optional("description", String())),
			func(ctx context.Context, a obj) (any, error) {
				row := itemRow(a)
				row["isArchived"] = false
				saved, err := d.Repo.Save(ctx, entity.Items, row, false)
				if err != nil {
					return nil, keyOf(err)
				}
				return rowToJSON(saved), nil
			}},
		{"update_item", "Update item/product", "",
			Input(Required("id", Number()), Required("name", String()), Required("amount", String()), Optional("unitId", Number()),
				Optional("categoryId", Number()), Optional("description", String()), Optional("isArchived", With(Boolean(), false))),
			func(ctx context.Context, a obj) (any, error) {
				row := itemRow(a)
				row["id"] = a["id"]
				row["isArchived"] = boolArg(a, "isArchived", false)
				saved, err := d.Repo.Save(ctx, entity.Items, row, true)
				if err != nil {
					return nil, keyOf(err)
				}
				return rowToJSON(saved), nil
			}},
		{"delete_item", "Delete item/product", "", Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				if err := d.Repo.Delete(ctx, entity.Items, intArg(a, "id")); err != nil {
					return nil, keyOf(err)
				}
				return obj{"success": true}, nil
			}},
		{"list_us_sales_tax_rates", "List US sales tax rates",
			"List US state-level base sales tax rates (50 states + DC). These are state base rates only — combined state+local rates vary by jurisdiction.",
			Input(),
			func(ctx context.Context, _ obj) (any, error) {
				rows, err := d.Repo.Select(ctx, "us_sales_tax_rates", `ORDER BY "stateName" ASC`)
				if err != nil {
					return nil, keyOf(err)
				}
				return rows, nil
			}},
		{"list_invoices", "Search invoices or quotes",
			"Search/list invoices and quotes with filters and pagination. Returns summaries; use get_invoice for full detail.",
			Input(Optional("invoiceType", Enum("invoice", "quotation")), Optional("clientId", Number()), Optional("status", Enum(statuses...)),
				Optional("search", Described(String(), "Matches invoice number or client name")),
				Optional("from", Described(String(), "ISO date, issued on/after")), Optional("to", Described(String(), "ISO date, issued on/before")),
				Optional("limit", Described(Number(), "Default 50, max 200")), Optional("offset", Number())),
			func(ctx context.Context, a obj) (any, error) {
				q := invoices.Query{Type: strOr(a, "invoiceType", ""), Status: strOr(a, "status", ""), Search: strOr(a, "search", ""),
					From: strOr(a, "from", ""), To: strOr(a, "to", "")}
				for k, into := range map[string]**float64{"clientId": &q.ClientID, "limit": &q.Limit, "offset": &q.Offset} {
					if has(a, k) {
						f := numArg(a, k)
						*into = &f
					}
				}
				page, err := d.Invoices.Find(ctx, q)
				if err != nil {
					return nil, keyOf(err)
				}
				return page, nil
			}},
		{"get_invoice", "Get invoice",
			"Get full detail for a single invoice or quote by id, including line items, snapshots and payments.",
			Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				inv, err := d.Invoices.ByID(ctx, intArg(a, "id"))
				if err != nil {
					return nil, keyOf(err)
				}
				if inv == nil {
					return nil, errors.New("error.invoiceNotFound")
				}
				return inv, nil
			}},
		{"create_invoice", "Create invoice or quote",
			"Create a new invoice or quote for a client, business and currency that already exist. Line items reference existing products via itemId. " +
				"For US sales tax, either pass taxName/taxRate directly, or pass usSalesTaxState (a 2-letter state code) to look up the current state base rate automatically — " +
				"no tax is applied if the client is tax-exempt.",
			Input(Optional("invoiceType", With(Enum("invoice", "quotation"), "invoice")), Required("businessId", Number()), Required("clientId", Number()),
				Required("currencyId", Number()), Optional("dueDate", String()), Optional("customerNotes", String()), Optional("thanksNotes", String()),
				Optional("termsConditionNotes", String()), Optional("taxName", String()), Optional("taxRate", With(Number(), 0)),
				Optional("usSalesTaxState", ExactLen(2)), Optional("taxType", Enum("exclusive", "inclusive", "deducted")),
				Optional("discountPercent", With(Number(), 0)), Optional("shippingFeeCents", With(String(), "0")),
				Required("items", Array(Object(Required("itemId", Number()), Optional("quantity", With(String(), "1")), Optional("unitPriceCentsOverride", String()),
					Optional("taxRate", With(Number(), 0)), Optional("taxType", Enum("exclusive", "inclusive"))), 1))),
			func(ctx context.Context, a obj) (any, error) { return createInvoice(ctx, d, a) }},
		{"update_invoice_status", "Update invoice status",
			"Change an invoice/quote status (e.g. mark closed/cancelled) without touching its line items or payments.",
			Input(Required("id", Number()), Required("status", Enum(statuses...))),
			func(ctx context.Context, a obj) (any, error) {
				inv, err := d.Invoices.ByID(ctx, intArg(a, "id"))
				if err != nil {
					return nil, keyOf(err)
				}
				if inv == nil {
					return nil, errors.New("error.invoiceNotFound")
				}
				req := invoices.ToRequest(inv)
				req["status"] = a["status"]
				res, err := d.Invoices.Update(ctx, req)
				if err != nil {
					return nil, keyOf(err)
				}
				return res, nil
			}},
		{"record_payment", "Record a payment against an invoice",
			"Add a payment to an existing invoice. Supports partial payments — call multiple times to record several payments.",
			Input(Required("invoiceId", Number()), Required("amountCents", String()), Required("paymentMethod", String()), Optional("paidAt", String()), Optional("notes", String())),
			func(ctx context.Context, a obj) (any, error) {
				inv, err := d.Invoices.ByID(ctx, intArg(a, "invoiceId"))
				if err != nil {
					return nil, keyOf(err)
				}
				if inv == nil {
					return nil, errors.New("error.invoiceNotFound")
				}
				req := invoices.ToRequest(inv)
				pays, _ := req["invoicePayments"].([]entity.Row)
				req["invoicePayments"] = append(pays, entity.Row{"amountCents": a["amountCents"], "paymentMethod": a["paymentMethod"],
					"paidAt": strOr(a, "paidAt", time.Now().UTC().Format("2006-01-02T15:04:05.000Z")), "notes": strArg(a, "notes")})
				res, err := d.Invoices.Update(ctx, req)
				if err != nil {
					return nil, keyOf(err)
				}
				return res, nil
			}},
		{"delete_invoice", "Delete invoice or quote", "Permanently delete an invoice/quote. This does not renumber past invoices.",
			Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				if err := d.Invoices.Delete(ctx, intArg(a, "id")); err != nil {
					return nil, keyOf(err)
				}
				return obj{"success": true}, nil
			}},
		{"list_ecommerce_integrations", "List e-commerce integrations",
			"List connected e-commerce stores (Shopify/WooCommerce/generic webhook) that auto-create invoices from orders. Never includes the webhook secret.",
			Input(),
			func(ctx context.Context, _ obj) (any, error) {
				rows, err := d.Orders.List(ctx, "")
				if err != nil {
					return nil, keyOf(err)
				}
				return rows, nil
			}},
		{"create_ecommerce_integration", "Connect an e-commerce store",
			"Register a new e-commerce store (Shopify, WooCommerce, or a generic webhook source) so its orders auto-create invoices. Returns a webhook secret ONCE — it cannot be retrieved again afterwards, so surface it to the user and tell them to put it in their store's webhook settings immediately.",
			Input(Required("name", String()), Required("platform", Enum("shopify", "woocommerce", "generic")), Required("businessId", Number()),
				Required("currencyId", Number()), Optional("bankId", Number()), Optional("layoutId", Number()), Optional("styleProfilesId", Number()),
				Optional("defaultTaxRate", With(Number(), 0)), Optional("autoIssue", With(Boolean(), true))),
			func(ctx context.Context, a obj) (any, error) {
				in := orders.NewIntegration{Name: strOr(a, "name", ""), Platform: strOr(a, "platform", ""),
					BusinessID: numArg(a, "businessId"), CurrencyID: numArg(a, "currencyId")}
				for k, into := range map[string]**float64{"bankId": &in.BankID, "layoutId": &in.LayoutID, "styleProfilesId": &in.StyleProfilesID, "defaultTaxRate": &in.DefaultTaxRate} {
					if has(a, k) {
						f := numArg(a, k)
						*into = &f
					}
				}
				auto := boolArg(a, "autoIssue", true)
				in.AutoIssue = &auto
				id, platform, secret, err := d.Orders.Create(ctx, in)
				if err != nil {
					return nil, keyOf(err)
				}
				return obj{"integration": obj{"id": id, "name": strings.TrimSpace(in.Name), "platform": platform}, "webhookSecret": secret,
					"warning": "This secret is shown once. Store it now — the app cannot display it again."}, nil
			}},
		{"deactivate_ecommerce_integration", "Deactivate an e-commerce integration",
			"Stop a connected store from creating any further invoices. Does not delete past orders/invoices.",
			Input(Required("id", Number())),
			func(ctx context.Context, a obj) (any, error) {
				if err := d.Orders.Deactivate(ctx, intArg(a, "id")); err != nil {
					return nil, keyOf(err)
				}
				return obj{"success": true}, nil
			}},
		{"create_invoice_from_order", "Create an invoice from an order",
			"Manually turn an order (from any source, or one you compose yourself) into an invoice through a connected integration's default business/currency/bank/layout, without going through a webhook. Useful for backfilling an order a webhook missed, or for sources with no webhook at all.",
			Input(Required("integrationId", Number()), Required("externalOrderId", String()), Optional("orderNumber", String()), Required("customerName", String()),
				Optional("customerEmail", String()), Optional("customerPhone", String()), Optional("customerAddress", String()), Optional("customerCountryCode", String()),
				Required("lineItems", Array(Object(Required("name", String()), Required("quantity", Number()), Required("unitPriceMajor", Number())), 1)),
				Optional("shippingMajor", With(Number(), 0)), Optional("taxRatePercent", Number()), Optional("notes", String())),
			func(ctx context.Context, a obj) (any, error) { return orderToInvoice(ctx, d, a) }},
	}
}

func orderToInvoice(ctx context.Context, d Deps, a obj) (any, error) {
	integ, err := d.Orders.Active(ctx, intArg(a, "integrationId"))
	if err != nil {
		return nil, keyOf(err)
	}
	if integ == nil {
		return nil, errors.New("error.notFound")
	}
	external := strOr(a, "externalOrderId", "")
	existing, err := d.Orders.FindOrder(ctx, integ.ID, external)
	if err != nil {
		return nil, keyOf(err)
	}
	if existing != nil && existing.Status == "processed" {
		var invoiceID any
		if existing.InvoiceID.Valid {
			invoiceID = existing.InvoiceID.Int64
		}
		return obj{"invoiceId": invoiceID, "deduplicated": true}, nil
	}
	o := orders.Order{ExternalID: external,
		Customer:      orders.Customer{Name: a["customerName"], Email: a["customerEmail"], Phone: a["customerPhone"], Address: a["customerAddress"], CountryCode: a["customerCountryCode"]},
		ShippingMajor: numOr(a, "shippingMajor", 0), Notes: a["notes"]}
	if has(a, "taxRatePercent") {
		o.TaxRatePercent = numArg(a, "taxRatePercent")
	}
	for _, li := range a["lineItems"].([]any) {
		m := li.(obj)
		o.Lines = append(o.Lines, orders.Line{Name: m["name"], Quantity: m["quantity"], UnitPriceMajor: m["unitPriceMajor"]})
	}
	var recordID int64
	if existing != nil {
		recordID = existing.ID
	} else if recordID, err = d.Orders.RecordReceived(ctx, integ.ID, external, "mcp-manual"); err != nil {
		return nil, keyOf(err)
	}
	invoiceID, number, err := d.Orders.CreateInvoice(ctx, integ, o)
	if err != nil {
		f := entity.MapError(err)
		reason := f.Message
		if reason == "" {
			reason = f.Key
		}
		_ = d.Orders.MarkFailed(ctx, recordID, reason)
		key := f.Key
		if key == "" {
			key = "error.unknownError"
		}
		return nil, errors.New(key)
	}
	_ = d.Orders.MarkProcessed(ctx, recordID, invoiceID)
	return obj{"invoiceId": invoiceID, "invoiceNumber": number}, nil
}

func createInvoice(ctx context.Context, d Deps, a obj) (any, error) {
	one := func(table string, id int64) (entity.Row, error) {
		rows, err := d.Repo.Select(ctx, table, `WHERE t."id" = ?`, id)
		if err != nil || len(rows) == 0 {
			return nil, err
		}
		return rows[0], nil
	}
	business, err := one("businesses", intArg(a, "businessId"))
	if err != nil {
		return nil, keyOf(err)
	}
	client, err := one("clients", intArg(a, "clientId"))
	if err != nil {
		return nil, keyOf(err)
	}
	currency, err := one("currencies", intArg(a, "currencyId"))
	if err != nil {
		return nil, keyOf(err)
	}
	switch {
	case business == nil:
		return nil, errors.New("error.businessNotFound")
	case client == nil:
		return nil, errors.New("error.clientNotFound")
	case currency == nil:
		return nil, errors.New("error.currencyNotFound")
	}

	var lines []entity.Row
	for _, li := range a["items"].([]any) {
		line := li.(obj)
		item, err := one("items", intArg(line, "itemId"))
		if err != nil {
			return nil, keyOf(err)
		}
		if item == nil {
			return nil, fmt.Errorf("error.itemNotFound: %v", jsnum.Format(numArg(line, "itemId")))
		}
		var unitName any
		if uid, ok := item["unitId"].(int64); ok && uid != 0 {
			if u, err := one("units", uid); err == nil && u != nil {
				unitName = u["name"]
			}
		}
		price := strOr(line, "unitPriceCentsOverride", "")
		if !has(line, "unitPriceCentsOverride") {
			price = "0"
			if s, ok := item["amount"].(string); ok {
				price = s
			}
		}
		lines = append(lines, entity.Row{"itemId": line["itemId"], "quantity": strOr(line, "quantity", "1"), "taxRate": numOr(line, "taxRate", 0),
			"taxType": strArg(line, "taxType"), "invoiceItemSnapshot": entity.Row{"itemName": item["name"], "unitPriceCents": price, "unitName": unitName}})
	}

	taxName := strArg(a, "taxName")
	taxRate := numOr(a, "taxRate", 0)
	if client["taxExempt"] == true {
		taxName, taxRate = nil, 0
	} else if state := strOr(a, "usSalesTaxState", ""); state != "" {
		rows, err := d.Repo.Select(ctx, "us_sales_tax_rates", `WHERE t."stateCode" = ?`, strings.ToUpper(state))
		if err == nil && len(rows) > 0 {
			taxName = fmt.Sprintf("%v Sales Tax", rows[0]["stateName"])
			taxRate = jsnum.Num(rows[0]["rate"])
		}
	}
	typ := "invoice"
	if strOr(a, "invoiceType", "invoice") == "quotation" {
		typ = "quotation"
	}
	number := "1"
	if next, err := d.Invoices.NextSequence(ctx, intArg(a, "businessId"), intArg(a, "clientId"), typ); err != nil {
		return nil, keyOf(err)
	} else if next != nil {
		number, _ = next["formattedSequence"].(string)
	}
	var taxType any
	if taxName != nil && taxName != "" {
		taxType = strOr(a, "taxType", "exclusive")
	}
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	payload := entity.Row{
		"invoiceType": typ, "businessId": a["businessId"], "clientId": a["clientId"], "currencyId": a["currencyId"],
		"issuedAt": now, "dueDate": strArg(a, "dueDate"), "invoiceNumber": number, "isArchived": false, "status": "unpaid",
		"customerNotes": strArg(a, "customerNotes"), "thanksNotes": strArg(a, "thanksNotes"), "termsConditionNotes": strArg(a, "termsConditionNotes"),
		"discountAmountCents": "0", "discountPercent": numOr(a, "discountPercent", 0), "shippingFeeCents": strOr(a, "shippingFeeCents", "0"),
		"surchargeAmountCents": "0", "surchargePercent": 0, "taxName": taxName, "taxRate": taxRate, "taxType": taxType, "language": "en",
		"invoiceItems":            lines,
		"invoiceBusinessSnapshot": entity.Row{"businessName": business["name"], "businessShortName": business["shortName"], "businessVatCode": business["vatCode"]},
		"invoiceClientSnapshot": entity.Row{"clientName": client["name"], "clientAddress": client["address"], "clientEmail": client["email"],
			"clientPhone": client["phone"], "clientCode": client["code"], "clientAdditional": client["additional"], "clientVatCode": client["vatCode"],
			"clientCountryCode": client["countryCode"], "clientTaxExempt": client["taxExempt"], "clientTaxExemptionCertificate": client["taxExemptionCertificate"]},
		"invoiceCurrencySnapshot": entity.Row{"currencyCode": currency["code"], "currencySymbol": currency["symbol"], "currencySubunit": currency["subunit"]},
	}
	res, err := d.Invoices.Add(ctx, payload)
	if err != nil {
		return nil, keyOf(err)
	}
	return res, nil
}
