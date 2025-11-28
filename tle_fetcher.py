#!/usr/bin/env python3
"""
TLE Fetcher (cron version)
- Fetches TLEs for a fixed list of NORAD IDs
- Writes JSON to ./static/tle_data.json
- Exits with 0 on success, 1 on error
"""

import asyncio
import json
from datetime import datetime, timedelta
from pathlib import Path
import aiohttp
import sys

# ---------- Paths ----------
SCRIPT_DIR = Path(__file__).resolve().parent
TLE_FILE   = SCRIPT_DIR / "static" / "tle_data.json"
LOG_FILE   = SCRIPT_DIR / "tle_fetcher.cron.log"

# ---------- Satellites to fetch (NORAD IDs must match your JS) ----------
SATELLITES = [
    #{"name": "MICE-1", "norad_id": "25544"},
    #{"name": "LAMARR", "norad_id": "60240"},
    #{"name": "DIRAC", "norad_id": "44714"},
    {
        "name": "DUTHSat-2",
        "norad_id": None,
        "manual_tle": """1 64532U 25135E   25267.31645216  .00019005  00000-0  92304-3 0  9992
2 64532  97.4549  20.3503 0005468  29.9791 330.1755 15.18487677 14466"""
    },
    {
        "name": "LAMARR",
        "norad_id": None,
        "manual_tle": """1 00000U 00000A   25332.80257208  .00000000  00000-0  00000+0 0  19
2 00000  97.4389  38.1891 0001412  60.6914 292.3934 15.17674854 06"""
    },
    {
        "name": "DIRAC",
        "norad_id": None,
        "manual_tle": """1 00000U 00000A   25332.80269940  .00000000  00000-0  00000+0 0  15
2 00000  97.4388  38.1892 0001406  61.4564 292.3237 15.17677228 03"""
    },
    {
        "name": "MICE-1",
        "norad_id": None,
        "manual_tle": """1 00000U 00000A   25332.80200264  .00000000  00000+0  00000+0 0  19
2 00000  97.4391  38.1885  0001420  59.9253 290.0519 15.17663614 04"""
    }
]


# ---------- Logging ----------
def log(msg: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"{timestamp} - {msg}"
    print(line)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass  # don't fail just because logging failed

# ---------- Helpers ----------
def parse_tle_epoch(tle_line1: str):
    """Return datetime from TLE line 1 epoch, or None."""
    try:
        epoch_str   = tle_line1[18:32]    # YYDDD.DDDDDDDD
        year_2      = int(epoch_str[:2])
        day_of_year = float(epoch_str[2:])
        year_4 = 2000 + year_2 if year_2 < 57 else 1900 + year_2
        return datetime(year_4, 1, 1) + timedelta(days=day_of_year - 1)
    except Exception as e:
        log(f"Error parsing epoch: {e}")
        return None

async def fetch_tle(session: aiohttp.ClientSession, norad_id: str):
    """
    Try direct CelesTrak first, then AllOrigins as a CORS-friendly fallback.
    Returns a 'line1\\nline2' string or None.
    """
    methods = [
        ("Direct", f"https://celestrak.com/NORAD/elements/gp.php?CATNR={norad_id}&FORMAT=TLE", "text"),
        ("AllOrigins", f"https://api.allorigins.win/get?url="
                       f"https%3A//celestrak.com/NORAD/elements/gp.php%3FCATNR%3D{norad_id}%26FORMAT%3DTLE", "json"),
    ]
    for name, url, kind in methods:
        try:
            log(f"[{norad_id}] Trying {name}…")
            async with session.get(url, timeout=30) as resp:
                if resp.status != 200:
                    log(f"[{norad_id}] {name} status {resp.status}")
                    continue
                if kind == "json":
                    data = await resp.json()
                    text = data.get("contents", "")
                else:
                    text = await resp.text()

            lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
            # find the first L1/L2 pair
            l1 = next((ln for ln in lines if ln.startswith("1 ")), None)
            l2 = next((ln for ln in lines if ln.startswith("2 ")), None)
            if l1 and l2 and len(l1) >= 69 and len(l2) >= 69:
                epoch = parse_tle_epoch(l1)
                age_h = (datetime.now() - epoch).total_seconds()/3600 if epoch else None
                log(f"[{norad_id}] OK via {name} (epoch age: {age_h:.1f}h)" if epoch else f"[{norad_id}] OK via {name}")
                return f"{l1}\n{l2}"
            else:
                log(f"[{norad_id}] {name} returned invalid TLE format")
        except asyncio.TimeoutError:
            log(f"[{norad_id}] {name} timed out")
        except Exception as e:
            log(f"[{norad_id}] {name} error: {e}")
    return None

async def fetch_all():
    log("==== TLE fetch start ====")

    # Load previous file (so we can fall back if a sat fails today)
    previous = {}
    if TLE_FILE.exists():
        try:
            previous = json.loads(TLE_FILE.read_text(encoding="utf-8"))
            log(f"Loaded existing file with {len(previous.get('satellites', {}))} sats")
        except Exception as e:
            log(f"Warning: failed to read existing JSON: {e}")

    out = {
        "last_updated": datetime.now().isoformat(),
        "satellites": {},
        "fetch_log": []
    }

    async with aiohttp.ClientSession() as session:
        for sat in SATELLITES:
            nid  = sat.get("norad_id")
            name = sat["name"]

            tle = None
            # Try fetching if NORAD ID exists
            if nid:
                tle = await fetch_tle(session, nid)

            # Fall back to manual TLE if provided
            if not tle and "manual_tle" in sat:
                log(f"[{name}] Using manual TLE (no fetch)")
                tle = sat["manual_tle"]

            if tle:
                l1 = tle.splitlines()[0]
                epoch = parse_tle_epoch(l1)
                key = nid or name  # use NORAD ID if available, else name
                out["satellites"][key] = {
                    "name": name,
                    "norad_id": nid,
                    "tle": tle,
                    "epoch": epoch.isoformat() if epoch else None,
                    "fetched_at": datetime.now().isoformat(),
                    "source": "manual" if "manual_tle" in sat else "celestrak"
                }
                out["fetch_log"].append({
                    "norad_id": nid or "manual",
                    "name": name,
                    "status": "success",
                    "timestamp": datetime.now().isoformat()
                })
            else:
                # Fall back to previous if available
                prev_sat = previous.get("satellites", {}).get(nid or name)
                if prev_sat:
                    out["satellites"][nid or name] = prev_sat
                    out["satellites"][nid or name]["note"] = "Using previous TLE (fetch/manual failed today)"
                    out["fetch_log"].append({
                        "norad_id": nid or "manual",
                        "name": name,
                        "status": "fallback",
                        "timestamp": datetime.now().isoformat()
                    })
                    log(f"[{name}] Using previous TLE")
                else:
                    out["fetch_log"].append({
                        "norad_id": nid or "manual",
                        "name": name,
                        "status": "failed",
                        "timestamp": datetime.now().isoformat()
                    })
                    log(f"[{name}] No TLE available (no previous, no manual)")

    # Write file
    try:
        TLE_FILE.parent.mkdir(parents=True, exist_ok=True)
        TLE_FILE.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
        ok = sum(1 for r in out["fetch_log"] if r["status"] in ("success", "fallback"))
        log(f"Saved {ok}/{len(SATELLITES)} TLEs → {TLE_FILE}")
        log("==== TLE fetch done ====")
        return True
    except Exception as e:
        log(f"Failed to write {TLE_FILE}: {e}")
        return False


def main():
    success = asyncio.run(fetch_all())
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()