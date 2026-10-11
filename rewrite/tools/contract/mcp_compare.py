#!/usr/bin/env python3
"""Diffs two MCP conversations. Timestamps, ids that come from the clock and
random secrets are masked; tool schemas and results must otherwise be equal."""
import json, re, sys

def norm(v):
    if isinstance(v, dict):
        return {k: ("<random>" if k in ("webhookSecret",) else norm(x)) for k, x in v.items()}
    if isinstance(v, list): return [norm(x) for x in v]
    if isinstance(v, str):
        if re.fullmatch(r"\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(\.\d+)?Z?", v): return "<time>"
        # tool results are JSON text: parse and normalise them too
        if v[:1] in "{[":
            try: return json.dumps(norm(json.loads(v)), sort_keys=True)
            except ValueError: pass
    return v

def sortlists(v):
    if isinstance(v, dict):
        return {k: sortlists(x) for k, x in v.items() if k != "$schema"}
    if isinstance(v, list):
        out = [sortlists(x) for x in v]
        return out
    return v

a, b = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
bad = 0
for x, y in zip(a, b):
    nx, ny = norm(sortlists(x["reply"])), norm(sortlists(y["reply"]))
    if nx != ny:
        bad += 1
        print("DIFF", x["method"], json.dumps(x["params"])[:150])
        print("  ts:", json.dumps(nx)[:700]); print("  go:", json.dumps(ny)[:700])
if len(a) != len(b): bad += 1; print("different number of messages", len(a), len(b))
print(f"{len(a)} MCP replies compared, {bad} differences")
sys.exit(1 if bad else 0)
