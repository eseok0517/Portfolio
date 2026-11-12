#!/usr/bin/env python3
"""
Download federal contract awards performed in Arizona from the USAspending.gov API
(public, no API key) and write data/az_spending.json for the Arizona Public Spending page.

Scope: prime contract awards (award types A-D) with place of performance in Arizona and an
award amount of at least $100,000, for the last three federal fiscal years. The API returns at
most 10,000 records per query, sorted here by award amount (largest first), so each fiscal
year is queried separately. Awards seen in more than one year are counted once.

The output holds aggregates (by agency, industry, recipient), concentration measures, and
review lists for awards with unusual patterns. It does not store the raw award table.

Standard library only. Usage:
  python scripts/fetch_az_spending.py                    # live download
  python scripts/fetch_az_spending.py --fixture FILE     # JSON list of award dicts (testing only)
"""
import argparse
import json
import os
import sys
import time
import urllib.request
from datetime import date, datetime, timezone

API = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
FIELDS = ["Award ID", "Recipient Name", "Start Date", "End Date", "Award Amount", "Total Outlays",
          "Awarding Agency", "Awarding Sub Agency", "NAICS", "Description"]
MIN_AMOUNT = 100000
PAGE = 100
MAX_PAGES = 100  # the API does not page past 10,000 results
CLOSEOUT_MIN = 100000
OVERSPEND_TOL = 1000


def fiscal_year_bounds(today):
    fy = today.year + (1 if today.month >= 10 else 0)
    return [(fy - k, f"{fy - k - 1}-10-01", f"{fy - k}-09-30") for k in (2, 1, 0)]


def post(body, tries=4):
    data = json.dumps(body).encode("utf-8")
    for attempt in range(tries):
        req = urllib.request.Request(API, data=data, headers={"Content-Type": "application/json", "User-Agent": "portfolio-data-pipeline (github.com/eseok0517)"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - retry on any transport or HTTP error
            if attempt == tries - 1:
                raise
            print(f"retry after error: {e}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))


def fetch_year(start, end):
    out = []
    for page in range(1, MAX_PAGES + 1):
        body = {
            "filters": {
                "award_type_codes": ["A", "B", "C", "D"],
                "time_period": [{"start_date": start, "end_date": end}],
                "place_of_performance_locations": [{"country": "USA", "state": "AZ"}],
                "award_amounts": [{"lower_bound": MIN_AMOUNT}],
            },
            "fields": FIELDS, "page": page, "limit": PAGE,
            "sort": "Award Amount", "order": "desc", "subawards": False,
        }
        res = post(body)
        rows = res.get("results")
        if rows is None:
            raise RuntimeError(f"Unexpected response (no 'results'): {str(res)[:300]}")
        out.extend(rows)
        if not res.get("page_metadata", {}).get("hasNext"):
            break
        time.sleep(0.3)
    return out


def text(v):
    if isinstance(v, dict):
        return " ".join(str(x) for x in (v.get("code"), v.get("description")) if x)
    return "" if v is None else str(v)


def code_of(v):
    if isinstance(v, dict):
        return str(v.get("code") or "")
    return str(v or "").split(" ")[0]


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def clean(rows):
    seen, out = {}, []
    for r in rows:
        aid = text(r.get("Award ID")).strip()
        amt = num(r.get("Award Amount"))
        if not aid or amt is None:
            continue
        rec = {
            "id": aid,
            "recipient": text(r.get("Recipient Name")).strip().title() or "(unnamed)",
            "start": (r.get("Start Date") or "")[:10],
            "end": (r.get("End Date") or "")[:10],
            "amount": amt,
            "outlays": num(r.get("Total Outlays")),
            "agency": text(r.get("Awarding Agency")).strip() or "(unknown)",
            "sub": text(r.get("Awarding Sub Agency")).strip(),
            "naics": code_of(r.get("NAICS")),
            "naics_desc": (r.get("NAICS") or {}).get("description", "") if isinstance(r.get("NAICS"), dict) else "",
            "desc": text(r.get("Description")).strip()[:140],
        }
        if aid in seen:
            continue
        seen[aid] = 1
        out.append(rec)
    return out


def top(items, key, n):
    agg = {}
    for r in items:
        k = key(r)
        a = agg.setdefault(k, {"amount": 0.0, "awards": 0})
        a["amount"] += max(0.0, r["amount"])
        a["awards"] += 1
    rows = sorted(agg.items(), key=lambda kv: -kv[1]["amount"])[:n]
    return [{"name": k, "amount": round(v["amount"]), "awards": v["awards"]} for k, v in rows]


def analyze(awards, today):
    pos = [r for r in awards if r["amount"] > 0]
    total = sum(r["amount"] for r in pos)
    by_rec = {}
    for r in pos:
        by_rec[r["recipient"]] = by_rec.get(r["recipient"], 0.0) + r["amount"]
    shares = sorted(by_rec.values(), reverse=True)
    share = lambda n: round(sum(shares[:n]) / total, 4) if total else 0
    hhi = round(sum((s / total * 100) ** 2 for s in shares)) if total else 0
    td = today.isoformat()

    def rec(r, extra):
        d = {k: r[k] for k in ("id", "recipient", "agency", "amount", "outlays", "start", "end")}
        d.update(extra)
        return d

    over, closeout, baddate = [], [], []
    for r in awards:
        if r["outlays"] is not None and r["outlays"] > r["amount"] + OVERSPEND_TOL and r["amount"] > 0:
            over.append(rec(r, {"gap": round(r["outlays"] - r["amount"])}))
        if r["end"] and r["end"] < td and r["outlays"] is not None and r["amount"] - r["outlays"] >= CLOSEOUT_MIN:
            closeout.append(rec(r, {"gap": round(r["amount"] - r["outlays"])}))
        if r["start"] and r["end"] and r["end"] < r["start"]:
            baddate.append(rec(r, {"gap": 0}))
    over.sort(key=lambda x: -x["gap"])
    closeout.sort(key=lambda x: -x["gap"])
    semi = [r for r in pos if r["naics"].startswith("3344")]
    mfg = [r for r in pos if r["naics"][:2] in ("31", "32", "33")]
    sizes = [("$100K to $250K", 100000, 250000), ("$250K to $1M", 250000, 1e6), ("$1M to $10M", 1e6, 1e7), ("$10M and over", 1e7, 1e18)]
    return {
        "awards": len(awards),
        "total_amount": round(total),
        "median_award": round(sorted(r["amount"] for r in pos)[len(pos) // 2]) if pos else 0,
        "recipients": len(by_rec),
        "concentration": {"top1": share(1), "top5": share(5), "top10": share(10), "hhi": hhi},
        "by_agency": top(pos, lambda r: r["agency"], 10),
        "by_industry": top(pos, lambda r: (r["naics"] + " " + r["naics_desc"]).strip() or "(no industry code)", 10),
        "by_recipient": top(pos, lambda r: r["recipient"], 15),
        "size_buckets": [{"name": n, "awards": sum(1 for r in pos if lo <= r["amount"] < hi), "amount": round(sum(r["amount"] for r in pos if lo <= r["amount"] < hi))} for n, lo, hi in sizes],
        "manufacturing": {"awards": len(mfg), "amount": round(sum(r["amount"] for r in mfg))},
        "semiconductor": {"awards": len(semi), "amount": round(sum(r["amount"] for r in semi))},
        "missing_outlays": sum(1 for r in awards if r["outlays"] is None),
        "flags": {
            "overspent": {"count": len(over), "amount": sum(x["gap"] for x in over), "top": over[:25]},
            "closeout": {"count": len(closeout), "amount": sum(x["gap"] for x in closeout), "top": closeout[:25]},
            "bad_dates": {"count": len(baddate), "top": baddate[:25]},
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data")
    ap.add_argument("--fixture", help="JSON file with a list of award dicts (testing only)")
    args = ap.parse_args()
    today = datetime.now(timezone.utc).date() if not args.fixture else date(2026, 11, 12)
    slices = fiscal_year_bounds(today)
    if args.fixture:
        with open(args.fixture, encoding="utf-8") as f:
            raw = json.load(f)
        counts = {}
    else:
        raw, counts = [], {}
        for fy, s, e in slices:
            rows = fetch_year(s, e)
            counts[f"FY{fy}"] = len(rows)
            print(f"FY{fy}: {len(rows)} awards", file=sys.stderr)
            raw.extend(rows)
    awards = clean(raw)
    if len(awards) < 200:
        sys.exit(f"Only {len(awards)} usable awards; refusing to overwrite az_spending.json")
    result = {
        "generated_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        "synthetic": bool(args.fixture),
        "source": "USAspending.gov API, prime contract awards (types A-D) with place of performance in Arizona",
        "scope": {"min_amount": MIN_AMOUNT, "fiscal_years": [f"FY{fy}" for fy, _, _ in slices],
                  "per_year_fetched": counts, "as_of": today.isoformat(),
                  "note": "Up to 10,000 largest awards per fiscal year; awards counted once."},
        "summary": analyze(awards, today),
    }
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, "az_spending.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"Wrote {len(awards)} awards' aggregates to {args.out}/az_spending.json")


if __name__ == "__main__":
    main()
