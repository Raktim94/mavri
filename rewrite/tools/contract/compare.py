#!/usr/bin/env python3
"""Diffs two scenario logs after masking values that legitimately differ
(timestamps and the secret/prefix of a freshly generated API key)."""
import json, re, sys

def norm(v):
    if isinstance(v, dict):
        out = {}
        for k, x in v.items():
            if k in ("secret", "keyPrefix"): out[k] = "<random>"
            elif k == "name" and isinstance(x, str) and re.fullmatch(r"key-[0-9a-f]{8}", x): out[k] = "<random>"
            else: out[k] = norm(x)
        return out
    if isinstance(v, list): return [norm(x) for x in v]
    if isinstance(v, str):
        if re.fullmatch(r"\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(\.\d+)?Z?", v): return "<time>"
    return v

a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
bad = 0
for x, y in zip(a, b):
    if norm(x) != norm(y):
        bad += 1
        print("DIFF", x["call"]); print("  ts:", json.dumps(norm(x))[:600]); print("  go:", json.dumps(norm(y))[:600])
if len(a) != len(b): bad += 1; print("different number of calls", len(a), len(b))
print(f"{len(a)} responses compared, {bad} differences")
sys.exit(1 if bad else 0)
