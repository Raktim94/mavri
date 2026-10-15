package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Updates: "is a newer Mavri published?" and "update me now".
//
// The latest version is the `version` in package.json on the main branch. When
// an updater is configured, it only counts once the matching image tag exists
// on GHCR (CI publishes after the push). Applying an update is delegated to the
// mavri-updater sidecar, because a container cannot replace itself and this
// server should not hold the Docker socket.

const updateCacheFor = 10 * time.Minute

var versionRe = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)`)

type latestCache struct {
	mu     sync.Mutex
	at     time.Time
	latest string
	err    string
}

var latest latestCache

func parseVersion(v string) ([3]int, bool) {
	m := versionRe.FindStringSubmatch(v)
	if m == nil {
		return [3]int{}, false
	}
	var out [3]int
	for i := range out {
		out[i], _ = strconv.Atoi(m[i+1])
	}
	return out, true
}

// newer reports whether a is a higher version than b; unparseable versions
// (such as a "dev" build) are never newer.
func newer(a, b string) bool {
	pa, okA := parseVersion(a)
	pb, okB := parseVersion(b)
	if !okA || !okB {
		return false
	}
	for i := range pa {
		if pa[i] != pb[i] {
			return pa[i] > pb[i]
		}
	}
	return false
}

// updateCheckOff reports whether the operator turned the version check off
// (UPDATE_CHECK=off), in which case Mavri never contacts GitHub or GHCR.
func updateCheckOff() bool { return strings.EqualFold(os.Getenv("UPDATE_CHECK"), "off") }

func updaterURL() string { return strings.TrimRight(os.Getenv("UPDATER_URL"), "/") }

func updateRepo() string {
	if r := os.Getenv("UPDATE_REPO"); r != "" {
		return r
	}
	return "Raktim94/mavri"
}

func getJSON(url string, headers map[string]string, out any) (int, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return 0, err
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusOK && out != nil {
		return res.StatusCode, json.NewDecoder(res.Body).Decode(out)
	}
	return res.StatusCode, nil
}

// imageTagExists asks GHCR anonymously. A clear 404 is false; anything else
// that goes wrong is "can't tell", and the caller trusts the version number.
func imageTagExists(repo, version string) (known, exists bool) {
	var tok struct {
		Token string `json:"token"`
	}
	if code, err := getJSON("https://ghcr.io/token?scope=repository:"+repo+":pull", nil, &tok); err != nil || code != http.StatusOK {
		return false, false
	}
	req, _ := http.NewRequest(http.MethodHead, "https://ghcr.io/v2/"+repo+"/manifests/"+version, nil)
	req.Header.Set("Authorization", "Bearer "+tok.Token)
	req.Header.Set("Accept", "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json")
	res, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return false, false
	}
	res.Body.Close()
	switch {
	case res.StatusCode == http.StatusNotFound:
		return true, false
	case res.StatusCode < 300:
		return true, true
	}
	return false, false
}

func fetchLatest() (string, error) {
	url := os.Getenv("UPDATE_CHECK_URL")
	if url == "" {
		url = "https://raw.githubusercontent.com/" + updateRepo() + "/main/package.json"
	}
	var pkg struct {
		Version string `json:"version"`
	}
	code, err := getJSON(url, map[string]string{"Cache-Control": "no-cache"}, &pkg)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK {
		return "", fmt.Errorf("GitHub answered %d", code)
	}
	if _, ok := parseVersion(pkg.Version); !ok {
		return "", fmt.Errorf("could not read the latest version")
	}
	if updaterURL() != "" && os.Getenv("UPDATE_CHECK_URL") == "" && newer(pkg.Version, Version) {
		if known, exists := imageTagExists(strings.ToLower(updateRepo()), pkg.Version); known && !exists {
			return Version, nil // announced, image not built yet
		}
	}
	return pkg.Version, nil
}

func updateStatus(force bool) map[string]any {
	if updateCheckOff() {
		return map[string]any{"current": Version, "latest": "", "updateAvailable": false, "canUpdate": false,
			"checkedAt": "", "checkError": "", "checkDisabled": true, "releaseUrl": "https://github.com/" + updateRepo() + "/releases"}
	}
	latest.mu.Lock()
	defer latest.mu.Unlock()
	if force || latest.at.IsZero() || time.Since(latest.at) > updateCacheFor {
		v, err := fetchLatest()
		if err != nil {
			// Offline installs are normal: keep the last answer, report "couldn't check".
			latest.err = err.Error()
			v = latest.latest
		} else {
			latest.err = ""
		}
		latest.latest, latest.at = v, time.Now()
	}
	return map[string]any{
		"current":         Version,
		"latest":          latest.latest,
		"updateAvailable": latest.latest != "" && newer(latest.latest, Version),
		"canUpdate":       updaterURL() != "",
		"checkedAt":       latest.at.UTC().Format(time.RFC3339),
		"checkError":      latest.err,
		"releaseUrl":      "https://github.com/" + updateRepo() + "/releases",
	}
}

func (s *Server) updateStatusHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, updateStatus(r.URL.Query().Get("refresh") == "1"))
}

func updaterCall(method, path string, body []byte) (int, []byte, error) {
	req, err := http.NewRequest(method, updaterURL()+path, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("UPDATER_TOKEN"))
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	var buf bytes.Buffer
	_, _ = buf.ReadFrom(res.Body)
	return res.StatusCode, buf.Bytes(), nil
}

func (s *Server) applyUpdate(w http.ResponseWriter, r *http.Request) {
	if updaterURL() == "" || updateCheckOff() {
		fail(w, http.StatusNotImplemented, "no_updater", "This install has no updater. Update Mavri the way you installed it.")
		return
	}
	st := updateStatus(true)
	if st["updateAvailable"] != true {
		fail(w, http.StatusConflict, "conflict", "You are already on the latest version")
		return
	}
	body, _ := json.Marshal(map[string]string{"version": st["latest"].(string)})
	code, resp, err := updaterCall(http.MethodPost, "/v1/update", body)
	switch {
	case err != nil:
		fail(w, http.StatusBadGateway, "updater", "Could not reach the updater container. Is it running?")
	case code == http.StatusUnauthorized:
		fail(w, http.StatusBadGateway, "updater", "The updater rejected the request (UPDATER_TOKEN mismatch)")
	case code == http.StatusConflict:
		fail(w, http.StatusConflict, "conflict", "An update is already in progress")
	case code >= 300:
		var e struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(resp, &e)
		fail(w, http.StatusBadGateway, "updater", "The updater refused: "+e.Error)
	default:
		s.Log.Info("update started", "from", Version, "to", st["latest"])
		writeJSON(w, http.StatusAccepted, map[string]any{"version": st["latest"]})
	}
}

func (s *Server) updateProgress(w http.ResponseWriter, r *http.Request) {
	if updaterURL() == "" {
		writeJSON(w, http.StatusOK, map[string]string{"state": "unknown"})
		return
	}
	code, resp, err := updaterCall(http.MethodGet, "/v1/status", nil)
	var p struct {
		State   string `json:"state"`
		Error   string `json:"error"`
		Version string `json:"version"`
	}
	if err != nil || code != http.StatusOK || json.Unmarshal(resp, &p) != nil {
		writeJSON(w, http.StatusOK, map[string]string{"state": "unknown"})
		return
	}
	writeJSON(w, http.StatusOK, p)
}
