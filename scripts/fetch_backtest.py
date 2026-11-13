#!/usr/bin/env python3
"""
Back-test the Bank Health Monitor's five warning screens against real FDIC bank failures.

For each failed bank, the screens are applied to the call report from about one year before failure.
The same screens are applied to a sample of banks that did not fail, at the same calendar dates, so the
share of healthy banks that also trip a screen (false alarms) is measured, not assumed.

Windows: the 2009-2012 credit crisis and the 2023-2026 rate shock (SVB, Signature, First Republic and later failures).
API: https://api.fdic.gov/banks (/failures, /institutions, /financials). Standard library only.
Writes data/backtest.json. Exits without writing if the samples are too small to report.
Usage: python scripts/fetch_backtest.py --out data
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import fetch_banks as fb

WINDOWS = [
    {"id": "crisis", "name": "2009-2012 credit crisis", "from": "2009-01-01", "to": "2012-12-31",
     "asof": ["20081231", "20091231", "20101231"], "max_failed": 150},
    {"id": "recent", "name": "2023-2026 rate shock", "from": "2023-01-01", "to": "2026-12-31",
     "asof": ["20211231", "20220630", "20221231"], "max_failed": 60},
]
FLAG_NAMES = ["Low ROA", "Margin squeeze", "Thin equity", "High loans/deposits", "Deposit outflow"]
N_CONTROLS = 250


def parse_date(s):
    s = str(s or "").strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%Y%m%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(s[:19] if "T" in fmt else s, fmt)
        except ValueError:
            continue
    return None


def flags_at(qs, i):
    """Same rules as the dashboard (bank-monitor.js)."""
    q = qs[i]
    out = []
    if q["roa"] is not None and q["roa"] < 0.5:
        out.append("Low ROA")
    if i >= 4 and q["nim"] is not None and qs[i - 4]["nim"] is not None and q["nim"] - qs[i - 4]["nim"] <= -0.25:
        out.append("Margin squeeze")
    if q["eq_assets"] is not None and q["eq_assets"] < 8:
        out.append("Thin equity")
    if q["loans_dep"] is not None and q["loans_dep"] > 90:
        out.append("High loans/deposits")
    if i >= 4 and q["deposits"] and qs[i - 4]["deposits"] and (q["deposits"] / qs[i - 4]["deposits"] - 1) * 100 <= -5:
        out.append("Deposit outflow")
    return out


def history(cert):
    fin = fb.rows(fb.get("financials", {"filters": f"CERT:{cert}", "fields": ",".join(fb.FIN_FIELDS), "sort_by": "REPDTE", "sort_order": "DESC", "limit": 80, "format": "json"}))
    return fb.build_bank({"CERT": cert}, "x", fin)["quarters"]


def index_on_or_before(qs, ymd):
    idx = [i for i, q in enumerate(qs) if q["date"] <= ymd]
    return idx[-1] if idx else None


def even_sample(items, n):
    if len(items) <= n:
        return list(items)
    step = (len(items) - 1) / (n - 1)
    return [items[round(i * step)] for i in range(n)]


def summarize(failed, controls):
    def rate(rows, pred):
        return round(100 * sum(1 for r in rows if pred(r)) / len(rows), 1) if rows else None
    per = {}
    for f in FLAG_NAMES:
        per[f] = {"failed": rate(failed, lambda r, f=f: f in r["flags"]), "survivors": rate(controls, lambda r, f=f: f in r["flags"])}
    return {
        "failed_n": len(failed), "survivor_obs": len(controls),
        "failed_any": rate(failed, lambda r: len(r["flags"]) >= 1), "survivors_any": rate(controls, lambda r: len(r["flags"]) >= 1),
        "failed_2plus": rate(failed, lambda r: len(r["flags"]) >= 2), "survivors_2plus": rate(controls, lambda r: len(r["flags"]) >= 2),
        "per_flag": per,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    args = ap.parse_args()

    fails = fb.rows(fb.get("failures", {"fields": "CERT,NAME,FAILDATE,QBFASSET,CITYST", "sort_by": "FAILDATE", "sort_order": "DESC", "limit": 2000, "format": "json"}))
    parsed = []
    for r in fails:
        d = parse_date(r.get("FAILDATE"))
        if d and r.get("CERT"):
            parsed.append((d, r))
    parsed.sort(key=lambda x: x[0])
    print(f"{len(parsed)} failures listed", file=sys.stderr)

    inst = fb.rows(fb.get("institutions", {"filters": "ACTIVE:1 AND ASSET:[100000 TO 5000000]", "fields": ",".join(fb.INST_FIELDS), "sort_by": "ASSET", "sort_order": "DESC", "limit": 10000, "format": "json"}))
    control_inst = even_sample(sorted(inst, key=lambda x: fb.num(x.get("ASSET")) or 0), N_CONTROLS)
    control_hist = {}
    for c in control_inst:
        try:
            control_hist[c["CERT"]] = history(c["CERT"])
        except Exception as e:  # noqa: BLE001
            print(f"skip control {c.get('CERT')}: {e}", file=sys.stderr)
        time.sleep(0.2)

    results = []
    for w in WINDOWS:
        lo, hi = parse_date(w["from"]), parse_date(w["to"])
        pool = [(d, r) for d, r in parsed if lo <= d <= hi]
        failed = []
        for d, r in even_sample(pool, w["max_failed"]):
            try:
                qs = history(r["CERT"])
            except Exception as e:  # noqa: BLE001
                print(f"skip failed {r.get('CERT')}: {e}", file=sys.stderr)
                continue
            time.sleep(0.2)
            target = (d - timedelta(days=365)).strftime("%Y%m%d")
            i = index_on_or_before(qs, target)
            if i is None or i < 1:
                continue
            failed.append({"name": r.get("NAME"), "failed": d.strftime("%Y-%m-%d"), "asof": qs[i]["date"], "assets": qs[i]["assets"], "flags": flags_at(qs, i)})
        controls = []
        for cert, qs in control_hist.items():
            for ymd in w["asof"]:
                i = index_on_or_before(qs, ymd)
                if i is not None and qs[i]["date"] == ymd and i >= 1:
                    controls.append({"cert": cert, "asof": ymd, "flags": flags_at(qs, i)})
        s = summarize(failed, controls)
        s.update({"id": w["id"], "name": w["name"], "asof_dates": w["asof"],
                  "examples": [{"name": f["name"], "failed": f["failed"], "asof": f["asof"], "flags": f["flags"]} for f in sorted(failed, key=lambda x: -(x["assets"] or 0))[:6]]})
        results.append(s)
        print(f"{w['id']}: {s['failed_n']} failed, {s['survivor_obs']} survivor observations", file=sys.stderr)

    usable = [r for r in results if r["failed_n"] >= 8 and r["survivor_obs"] >= 60]
    if not usable:
        sys.exit("Samples too small to report; refusing to write backtest.json")
    out = {"generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"), "source": "FDIC BankFind API (failures, financials)",
           "rule": "Screens applied to the call report from about one year before failure; survivors are banks still active, measured at the same dates.",
           "windows": usable}
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "backtest.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"Wrote {len(usable)} back-test windows to {args.out}/backtest.json")


if __name__ == "__main__":
    main()
