// Package vies asks the European Commission's VIES service whether an EU VAT number is active. It is an explicit
// action: Mavri never calls it by itself, and the number is sent to the Commission's service when it does.
package vies

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// DefaultURL is the Commission's public VIES REST service. VIES_URL overrides it (for tests or a mirror).
const DefaultURL = "https://ec.europa.eu/taxation_customs/vies/rest-api"

// Provider is what is recorded as the source of an answer.
const Provider = "EU VIES"

// Result is what VIES said.
type Result struct {
	Valid       bool   `json:"valid"`
	Unavailable bool   `json:"unavailable"` // the service or the member state's database did not answer: not the same as invalid
	Name        string `json:"name"`
	Address     string `json:"address"`
	Message     string `json:"message"`
	RequestDate string `json:"requestDate"`
}

// Client talks to VIES.
type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func (c *Client) base() string {
	if c.BaseURL != "" {
		return strings.TrimRight(c.BaseURL, "/")
	}
	if v := os.Getenv("VIES_URL"); v != "" {
		return strings.TrimRight(v, "/")
	}
	return DefaultURL
}

// Check asks about one number. country is the member state code and number the VAT number without the prefix.
func (c *Client) Check(ctx context.Context, country, number string) (Result, error) {
	country = strings.ToUpper(strings.TrimSpace(country))
	if country == "GR" {
		country = "EL" // Greece's VAT prefix in VIES
	}
	number = strings.ToUpper(strings.NewReplacer(" ", "", "-", "", ".", "").Replace(number))
	number = strings.TrimPrefix(number, country)
	if len(country) != 2 || number == "" || strings.ContainsAny(number, "/?#&") {
		return Result{}, fmt.Errorf("give a member state and a VAT number")
	}
	hc := c.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: 15 * time.Second}
	}
	u := c.base() + "/ms/" + url.PathEscape(country) + "/vat/" + url.PathEscape(number)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Accept", "application/json")
	res, err := hc.Do(req)
	if err != nil {
		return Result{Unavailable: true, Message: "the VIES service could not be reached"}, nil
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	var raw struct {
		IsValid      *bool  `json:"isValid"`
		Valid        *bool  `json:"valid"`
		Name         string `json:"name"`
		Address      string `json:"address"`
		RequestDate  string `json:"requestDate"`
		UserError    string `json:"userError"`
		ErrorCode    string `json:"errorCode"`
		ErrorWrapper []struct {
			Error string `json:"error"`
		} `json:"errorWrappers"`
	}
	_ = json.Unmarshal(body, &raw)
	out := Result{Name: clean(raw.Name), Address: clean(raw.Address), RequestDate: raw.RequestDate}
	switch {
	case res.StatusCode >= 500 || res.StatusCode == http.StatusTooManyRequests:
		out.Unavailable, out.Message = true, "the VIES service is not answering right now; try again later"
	case isDown(raw.UserError) || isDown(raw.ErrorCode) || len(raw.ErrorWrapper) > 0 && isDown(raw.ErrorWrapper[0].Error):
		out.Unavailable, out.Message = true, "the member state's database is not answering right now; try again later"
	default:
		v := raw.IsValid
		if v == nil {
			v = raw.Valid
		}
		if v == nil {
			out.Unavailable, out.Message = true, "VIES gave an answer Mavri could not read"
			break
		}
		out.Valid = *v
		if *v {
			out.Message = "VIES says this VAT number is active"
		} else {
			out.Message = "VIES says this VAT number is not active"
		}
	}
	return out, nil
}

func isDown(s string) bool {
	s = strings.ToUpper(s)
	return strings.Contains(s, "UNAVAILABLE") || strings.Contains(s, "TIMEOUT") || strings.Contains(s, "BUSY") || strings.Contains(s, "SERVICE_UNAVAILABLE")
}

func clean(s string) string {
	s = strings.TrimSpace(s)
	if s == "---" {
		return ""
	}
	return strings.Join(strings.Fields(strings.ReplaceAll(s, "\n", ", ")), " ")
}
