package orders

import "strings"

// Order is the platform-neutral shape every webhook payload is reduced to.
type Order struct {
	ExternalID any // string for Shopify and WooCommerce, whatever a generic sender gives
	Currency   any
	Customer   Customer
	Lines      []Line
	// ShippingMajor and TaxRatePercent are nil when not given.
	ShippingMajor  any
	TaxRatePercent any
	Notes          any
}

// Customer is the buyer.
type Customer struct {
	Name                               any
	Email, Phone, Address, CountryCode any
}

// Line is one ordered item; quantity and price keep the sender's type.
type Line struct {
	Name           any
	Quantity       any
	UnitPriceMajor any
}

func joinTruthy(parts ...any) string {
	var out []string
	for _, p := range parts {
		if truthy(p) {
			out = append(out, str(p))
		}
	}
	return strings.Join(out, " ")
}

func joinAddress(parts ...any) any {
	var out []string
	for _, p := range parts {
		if truthy(p) {
			out = append(out, str(p))
		}
	}
	if len(out) == 0 {
		return nil
	}
	return strings.Join(out, ", ")
}

// NormalizeShopify reads a Shopify "orders/create" payload.
func NormalizeShopify(p map[string]any) Order {
	customer, ship := obj(p["customer"]), obj(p["shipping_address"])
	name := strings.TrimSpace(joinTruthy(customer["first_name"], customer["last_name"]))
	if name == "" {
		name = str(firstDefined(p["email"], "Shopify Customer"))
	}
	o := Order{
		ExternalID: str(firstDefined(p["id"], p["order_number"], "")),
		Currency:   stringOr(p["currency"]),
		Customer: Customer{
			Name: name, Email: stringOr(p["email"]), Phone: stringOr(customer["phone"]),
			Address:     joinAddress(ship["address1"], ship["address2"], ship["city"], ship["province"], ship["zip"], ship["country"]),
			CountryCode: stringOr(ship["country_code"]),
		},
		ShippingMajor: num(firstDefined(obj(obj(p["total_shipping_price_set"])["shop_money"])["amount"], 0)),
		Notes:         stringOr(p["note"]),
	}
	for _, li := range list(p["line_items"]) {
		o.Lines = append(o.Lines, Line{Name: str(firstDefined(li["title"], li["name"], "Item")),
			Quantity: num(firstDefined(li["quantity"], 1)), UnitPriceMajor: num(firstDefined(li["price"], 0))})
	}
	return o
}

// NormalizeWooCommerce reads a WooCommerce order payload.
func NormalizeWooCommerce(p map[string]any) Order {
	billing := obj(p["billing"])
	name := strings.TrimSpace(joinTruthy(billing["first_name"], billing["last_name"]))
	if name == "" {
		name = str(firstDefined(billing["email"], "WooCommerce Customer"))
	}
	o := Order{
		ExternalID: str(firstDefined(p["id"], "")),
		Currency:   stringOr(p["currency"]),
		Customer: Customer{
			Name: name, Email: stringOr(billing["email"]), Phone: stringOr(billing["phone"]),
			Address:     joinAddress(billing["address_1"], billing["address_2"], billing["city"], billing["state"], billing["postcode"], billing["country"]),
			CountryCode: stringOr(billing["country"]),
		},
		ShippingMajor: num(firstDefined(p["shipping_total"], 0)),
		Notes:         stringOr(p["customer_note"]),
	}
	for _, li := range list(p["line_items"]) {
		o.Lines = append(o.Lines, Line{Name: str(firstDefined(li["name"], "Item")),
			Quantity: num(firstDefined(li["quantity"], 1)), UnitPriceMajor: num(firstDefined(li["price"], 0))})
	}
	return o
}

// NormalizeGeneric takes a payload already shaped like Order, from any sender.
func NormalizeGeneric(p map[string]any) Order {
	c := obj(p["customer"])
	o := Order{
		ExternalID: p["externalOrderId"], Currency: p["currencyCode"],
		Customer:      Customer{Name: c["name"], Email: c["email"], Phone: c["phone"], Address: c["address"], CountryCode: c["countryCode"]},
		ShippingMajor: p["shippingMajor"], TaxRatePercent: p["taxRatePercent"], Notes: p["notes"],
	}
	for _, li := range list(p["lineItems"]) {
		o.Lines = append(o.Lines, Line{Name: li["name"], Quantity: li["quantity"], UnitPriceMajor: li["unitPriceMajor"]})
	}
	return o
}

// Normalize picks the reader for the platform.
func Normalize(platform string, payload map[string]any) Order {
	switch platform {
	case "shopify":
		return NormalizeShopify(payload)
	case "woocommerce":
		return NormalizeWooCommerce(payload)
	}
	return NormalizeGeneric(payload)
}
