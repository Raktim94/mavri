package config

import (
	"encoding/json"
	"os"
	"testing"
)

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestDefaults(t *testing.T) {
	c := LoadFrom(env(nil))
	if c.Port != 3000 || c.Host != "127.0.0.1" || c.DataDir != "data" ||
		c.FrontendOrigin != "http://127.0.0.1:5173" || c.CookieSecure || c.TrustedProxies != 1 {
		t.Fatalf("unexpected defaults: %+v", c)
	}
}

func TestOverrides(t *testing.T) {
	c := LoadFrom(env(map[string]string{
		"PORT": "8080", "DEV_SERVER_URL": "0.0.0.0", "DB_DIRECTORY": "/data",
		"FE_SERVER_URL": "http://fe:1", "FRONTEND_ORIGIN": "https://app.example", "COOKIE_SECURE": "true",
	}))
	if c.Port != 8080 || c.Host != "0.0.0.0" || c.DataDir != "/data" ||
		c.FrontendOrigin != "https://app.example" || !c.CookieSecure {
		t.Fatalf("unexpected config: %+v", c)
	}
}

func TestFrontendOriginFallsBackToFEServer(t *testing.T) {
	c := LoadFrom(env(map[string]string{"FE_SERVER_URL": "http://fe:1"}))
	if c.FrontendOrigin != "http://fe:1" {
		t.Fatalf("got %q", c.FrontendOrigin)
	}
}

func TestBadPortFallsBack(t *testing.T) {
	for _, p := range []string{"abc", "0", "-1", "70000"} {
		if c := LoadFrom(env(map[string]string{"PORT": p})); c.Port != 3000 {
			t.Fatalf("PORT=%q gave %d", p, c.Port)
		}
	}
}

func TestCookieSecureOnlyExactlyTrue(t *testing.T) {
	for _, v := range []string{"1", "TRUE", "yes", ""} {
		if LoadFrom(env(map[string]string{"COOKIE_SECURE": v})).CookieSecure {
			t.Fatalf("COOKIE_SECURE=%q must not enable secure cookies", v)
		}
	}
}

func TestDefaultDatabase(t *testing.T) {
	cases := []struct {
		env  map[string]string
		want string
	}{
		{nil, ""},
		{map[string]string{"NODE_ENV": "docker"}, "invoice.db"},
		{map[string]string{"DEFAULT_DATABASE": "shop.db"}, "shop.db"},
		{map[string]string{"DEFAULT_DATABASE": "../../etc/x.db"}, "x.db"},
	}
	for _, c := range cases {
		if got := LoadFrom(env(c.env)).DefaultDB; got != c.want {
			t.Errorf("%v: got %q want %q", c.env, got, c.want)
		}
	}
}

func TestDefaultDatabaseSetEmptyDisablesDocker(t *testing.T) {
	look := func(k string) (string, bool) {
		return map[string]string{"NODE_ENV": "docker", "DEFAULT_DATABASE": ""}[k], k == "NODE_ENV" || k == "DEFAULT_DATABASE"
	}
	if got := loadWith(look).DefaultDB; got != "" {
		t.Errorf("explicitly empty DEFAULT_DATABASE should disable it, got %q", got)
	}
}

func TestTrustProxy(t *testing.T) {
	for in, want := range map[string]int{"": 1, "0": 0, "1": 1, "2": 2, "-1": 1, "99": 1, "abc": 1} {
		if got := LoadFrom(env(map[string]string{"TRUST_PROXY": in})).TrustedProxies; got != want {
			t.Errorf("TRUST_PROXY=%q -> %d, want %d", in, got, want)
		}
	}
}

// The version the API reports must be the one in package.json.
func TestVersionMatchesPackageJSON(t *testing.T) {
	data, err := os.ReadFile("../../../package.json")
	if err != nil {
		t.Skip("package.json not next to the Go module (a Docker build context)")
	}
	var pkg struct{ Version string }
	if err := json.Unmarshal(data, &pkg); err != nil {
		t.Fatal(err)
	}
	if Version != pkg.Version {
		t.Errorf("config.Version = %q but package.json says %q", Version, pkg.Version)
	}
}
