package shop

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Customer is who placed an order.
type Customer struct {
	Name, Email, Phone, Address, Country string
}

// OrderLine is one product on an order, priced in major units (12.50).
type OrderLine struct {
	Name           string
	Quantity       float64
	UnitPriceMajor float64
}

// Order is a store order in Mavri's own terms.
type Order struct {
	ExternalID     string
	Currency       string
	Customer       Customer
	Lines          []OrderLine
	ShippingMajor  float64
	TaxRatePercent *float64
	Notes          string
	Paid           bool
}

// ParseOrder reads a webhook body from a platform.
func ParseOrder(platform string, body []byte) (Order, error) {
	switch platform {
	case "shopify":
		return parseShopify(body)
	case "woocommerce":
		return parseWoo(body)
	case "generic":
		return parseGeneric(body)
	}
	return Order{}, fmt.Errorf("unknown platform %q", platform)
}

// number accepts a JSON number or a numeric string, which stores use for prices.
type number float64

func (n *number) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*n = 0
		return nil
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return fmt.Errorf("not a number: %s", s)
	}
	*n = number(f)
	return nil
}

// id accepts a number or a string.
type id string

func (i *id) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "null" {
		s = ""
	}
	*i = id(s)
	return nil
}

func parseGeneric(body []byte) (Order, error) {
	var in struct {
		ExternalOrderID id `json:"externalOrderId"`
		Currency        string
		Customer        struct {
			Name, Email, Phone, Address, CountryCode string
		}
		LineItems []struct {
			Name           string
			Quantity       number
			UnitPriceMajor number
		} `json:"lineItems"`
		ShippingMajor  number  `json:"shippingMajor"`
		TaxRatePercent *number `json:"taxRatePercent"`
		Notes          string  `json:"notes"`
		Paid           bool    `json:"paid"`
	}
	if err := json.Unmarshal(body, &in); err != nil {
		return Order{}, err
	}
	o := Order{ExternalID: string(in.ExternalOrderID), Currency: in.Currency, ShippingMajor: float64(in.ShippingMajor), Notes: in.Notes, Paid: in.Paid,
		Customer: Customer{in.Customer.Name, in.Customer.Email, in.Customer.Phone, in.Customer.Address, in.Customer.CountryCode}}
	if in.TaxRatePercent != nil {
		v := float64(*in.TaxRatePercent)
		o.TaxRatePercent = &v
	}
	for _, l := range in.LineItems {
		if strings.TrimSpace(l.Name) == "" || l.Quantity <= 0 || l.UnitPriceMajor < 0 {
			return Order{}, fmt.Errorf("every line needs a name, a positive quantity and a price")
		}
		o.Lines = append(o.Lines, OrderLine{l.Name, float64(l.Quantity), float64(l.UnitPriceMajor)})
	}
	return o, nil
}

type address struct {
	Name, Address1, Address2, City, Zip, Province, Country string
	CountryCode                                            string `json:"country_code"`
	FirstName                                              string `json:"first_name"`
	LastName                                               string `json:"last_name"`
	Postcode, State                                        string
	Email, Phone                                           string
}

func join(parts ...string) string {
	var out []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, "\n")
}

func parseShopify(body []byte) (Order, error) {
	var in struct {
		ID              id `json:"id"`
		Email, Phone    string
		Currency        string
		FinancialStatus string `json:"financial_status"`
		Note            string
		Customer        struct {
			FirstName string `json:"first_name"`
			LastName  string `json:"last_name"`
			Email     string
			Phone     string
		}
		BillingAddress address `json:"billing_address"`
		LineItems      []struct {
			Title    string
			Name     string
			Quantity number
			Price    number
		} `json:"line_items"`
		ShippingLines []struct{ Price number } `json:"shipping_lines"`
		TaxLines      []struct{ Rate number }  `json:"tax_lines"`
	}
	if err := json.Unmarshal(body, &in); err != nil {
		return Order{}, err
	}
	o := Order{ExternalID: string(in.ID), Currency: in.Currency, Notes: in.Note, Paid: in.FinancialStatus == "paid"}
	name := strings.TrimSpace(in.Customer.FirstName + " " + in.Customer.LastName)
	if name == "" {
		name = strings.TrimSpace(in.BillingAddress.Name)
	}
	o.Customer = Customer{Name: name, Email: firstOf(in.Email, in.Customer.Email), Phone: firstOf(in.Phone, in.Customer.Phone),
		Address: join(in.BillingAddress.Address1, in.BillingAddress.Address2, strings.TrimSpace(in.BillingAddress.Zip+" "+in.BillingAddress.City)),
		Country: in.BillingAddress.CountryCode}
	for _, l := range in.LineItems {
		o.Lines = append(o.Lines, OrderLine{firstOf(l.Title, l.Name), float64(l.Quantity), float64(l.Price)})
	}
	for _, s := range in.ShippingLines {
		o.ShippingMajor += float64(s.Price)
	}
	if len(in.TaxLines) > 0 {
		r := float64(in.TaxLines[0].Rate) * 100
		o.TaxRatePercent = &r
	}
	return o, nil
}

func parseWoo(body []byte) (Order, error) {
	var in struct {
		ID           id
		Currency     string
		Status       string
		Billing      address `json:"billing"`
		Email        string
		CustomerNote string `json:"customer_note"`
		LineItems    []struct {
			Name     string
			Quantity number
			Price    number
			Total    number
		} `json:"line_items"`
		ShippingTotal number `json:"shipping_total"`
	}
	if err := json.Unmarshal(body, &in); err != nil {
		return Order{}, err
	}
	o := Order{ExternalID: string(in.ID), Currency: in.Currency, Notes: in.CustomerNote, ShippingMajor: float64(in.ShippingTotal),
		Paid: in.Status == "completed" || in.Status == "processing"}
	o.Customer = Customer{Name: strings.TrimSpace(in.Billing.FirstName + " " + in.Billing.LastName), Email: in.Billing.Email, Phone: in.Billing.Phone,
		Address: join(in.Billing.Address1, in.Billing.Address2, strings.TrimSpace(in.Billing.Postcode+" "+in.Billing.City)), Country: in.Billing.Country}
	for _, l := range in.LineItems {
		price := float64(l.Price)
		if price == 0 && l.Quantity > 0 {
			price = float64(l.Total) / float64(l.Quantity)
		}
		o.Lines = append(o.Lines, OrderLine{l.Name, float64(l.Quantity), price})
	}
	return o, nil
}

func firstOf(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
