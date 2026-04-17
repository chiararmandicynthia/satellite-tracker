#!/usr/bin/env python3
# /home/ubuntu/env/bin/python /home/ubuntu/tle-tracker/tle_fetcher.py
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

# ---------- Satellites ----------
SATELLITES = [
    # ── From SatNOGS ─────────────────────────────
    {
        "name": "DUTHSat-2",
        "norad_id": "98592",
        "tle_source": "satnogs"
    },
    {
        "name": "LAMARR",
        "norad_id": "98530",
        "tle_source": "satnogs"
    },
    {
        "name": "DIRAC",
        "norad_id": "98529",
        "tle_source": "satnogs"
    },
    {
        "name": "MICE-1",
        "norad_id": "98518",
        "tle_source": "satnogs"
    },

    {
        "name": "PeakSat",
        "norad_id": "68416",
        "tle_source": "satnogs"
    },
    {
        "name": "OptiSat",
        "norad_id": "98370",
        "tle_source": "optisat"
    },
    {
        "name": "ERMIS-1",
        "norad_id": "68468",
        "tle_source": "satnogs"
    },
    {
        "name": "ERMIS-2",
        "norad_id": "68420",
        "tle_source": "satnogs"
    },
    {
        "name": "ERMIS-3",
        "norad_id": "98367",
        "tle_source": "satnogs"
    },
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
        pass


# ---------- Helpers ----------
def parse_tle_epoch(tle_line1: str):
    try:
        epoch_str   = tle_line1[18:32]
        year_2      = int(epoch_str[:2])
        day_of_year = float(epoch_str[2:])
        year_4 = 2000 + year_2 if year_2 < 57 else 1900 + year_2
        return datetime(year_4, 1, 1) + timedelta(days=day_of_year - 1)
    except Exception as e:
        log(f"Error parsing epoch: {e}")
        return None


# ---------- CelesTrak ----------
async def fetch_tle(session: aiohttp.ClientSession, norad_id: str):
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
                    continue
                if kind == "json":
                    data = await resp.json()
                    text = data.get("contents", "")
                else:
                    text = await resp.text()

            lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
            l1 = next((ln for ln in lines if ln.startswith("1 ")), None)
            l2 = next((ln for ln in lines if ln.startswith("2 ")), None)

            if l1 and l2:
                return f"{l1}\n{l2}"
        except Exception:
            pass
    return None


# ---------- SatNOGS ----------
async def fetch_tle_satnogs(session: aiohttp.ClientSession, norad_id: str):
    url = f"https://db.satnogs.org/api/tle/?norad_cat_id={norad_id}&tle_source=&sat_id="
    try:
        log(f"[{norad_id}] Trying SatNOGS…")
        async with session.get(url, timeout=30) as resp:
            if resp.status != 200:
                return None

            data = await resp.json()

        if not data:
            return None

        data.sort(key=lambda e: e.get("updated", ""), reverse=True)
        entry = data[0]

        l1 = entry.get("tle1")
        l2 = entry.get("tle2")

        if l1 and l2:
            return f"{l1.strip()}\n{l2.strip()}"

    except Exception as e:
        log(f"[{norad_id}] SatNOGS error: {e}")

    return None


# ---------- Main ----------
async def fetch_all():
    log("==== TLE fetch start ====")

    previous = {}
    if TLE_FILE.exists():
        try:
            previous = json.loads(TLE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass

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
            source_used = None
            mode = sat.get("tle_source", "celestrak")

            # ── Manual (skip APIs) ──
            if mode == "manual":
                tle = sat.get("manual_tle")
                source_used = "manual"

            # ── Fetch if needed ──
            elif nid:
                if mode in ("celestrak", "both"):
                    tle = await fetch_tle(session, nid)
                    if tle:
                        source_used = "celestrak"

                if not tle and mode in ("satnogs", "both"):
                    tle = await fetch_tle_satnogs(session, nid)
                    if tle:
                        source_used = "satnogs"

                if not tle and "manual_tle" in sat:
                    tle = sat["manual_tle"]
                    source_used = "manual"

            # ── Store ──
            if tle:
                key = nid or name
                l1 = tle.splitlines()[0]
                epoch = parse_tle_epoch(l1)

                out["satellites"][key] = {
                    "name": name,
                    "norad_id": nid,
                    "tle": tle,
                    "epoch": epoch.isoformat() if epoch else None,
                    "fetched_at": datetime.now().isoformat(),
                    "source": source_used
                }
            else:
                prev = previous.get("satellites", {}).get(nid or name)
                if prev:
                    out["satellites"][nid or name] = prev

    TLE_FILE.parent.mkdir(parents=True, exist_ok=True)
    TLE_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")

    log("==== TLE fetch done ====")
    return True


def main():
    success = asyncio.run(fetch_all())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()