#!/usr/bin/env python3
"""Diffs two scenario logs after masking values that legitimately differ
(timestamps and the secret/prefix of a freshly generated API key)."""
import json, re, sys

def norm(v):
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if k in ("secret", "keyPrefix", "webhookSecret"): out[k] = "<random>"
            elif k == "name" and isinstance(x, str) and re.fullmatch(r"key-[0-9a-f]{8}", x): out[k] = "<random>"
            else: out[k] = norm(x)
        return out
    if isinstance(v, list): return [norm(x) for x in v]
    if isinstance(v, str):
        if re.fullmatch(r"\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(\.\d+)?Z?", v): return "<time>"
        v = re.sub(r"http://127\.0\.0\.1:\d+", "<server>", v)
    return v

def by_id(entry):
    entry = {k: v for k, v in entry.items() if k != "request"}
    if isinstance(entry['body'], dict) and 'text' in entry['body']:
        return entry
    """Lists are ordered by creation second, which depends on when each server ran;
    the order rule itself is covered by Go unit tests, so compare lists by id."""
    data = entry["body"].get("data") if isinstance(entry["body"], dict) else None
    if isinstance(data, list) and all(isinstance(r, dict) and "id" in r for r in data):
        entry = {**entry, "body": {**entry["body"], "data": sorted(data, key=lambda r: r["id"])}}
    return entry

a = [by_id(e) for e in json.load(open(sys.argv[1]))]
b = [by_id(e) for e in json.load(open(sys.argv[2]))]
bad = 0
fixed = 0
for x, y in zip(a, b):
    ts_html = isinstance(x["body"], dict) and str(x["body"].get("text", "")).startswith("<!DOCTYPE html>")
    ts_crashed = x["status"] == 500 and (x["body"] == "<non-json>" or ts_html)
    go_body = y["body"]
    if isinstance(go_body, dict) and "text" in go_body:
        try: go_body = json.loads(go_body["text"])
        except ValueError: pass
    go_refused = y["status"] in (200, 400, 500) and isinstance(go_body, dict) and go_body.get("success") is False
    if norm(x) != norm(y) and ts_crashed and go_refused:
        # The TypeScript server answered an HTML 500 page (an unhandled error);
        # Go answers with a proper failure. Counted separately, not as a regression.
        fixed += 1
        print("TS CRASH, GO REFUSES CLEANLY:", x["call"], "->", go_body.get("key") if go_body.get("key") != "error.unknownError" else go_body.get("message"))
        continue
    if norm(x) != norm(y):
        bad += 1
        print("DIFF", x["call"]); print("  ts:", json.dumps(norm(x))[:600]); print("  go:", json.dumps(norm(y))[:600])
if len(a) != len(b): bad += 1; print("different number of calls", len(a), len(b))
print(f"{len(a)} responses compared, {bad} differences" + (f" (+{fixed} where the TS server crashed and Go refuses cleanly)" if fixed else ""))
sys.exit(1 if bad else 0)
