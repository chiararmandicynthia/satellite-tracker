import os
from datetime import timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from skyfield.api import load, EarthSatellite, wgs84

app = FastAPI()

# Allow all origins (safe for internal ops; restrict if public)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ts = load.timescale()

# ---------- Data Models ----------
class Station(BaseModel):
    name: str
    lat: float
    lng: float
    hgt_m: float

class PassRequest(BaseModel):
    tle1: str
    tle2: str
    stations: list[Station]

# ---------- API Endpoint ----------
@app.post("/next_pass_all")
def next_pass_all(req: PassRequest):
    sat = EarthSatellite(req.tle1, req.tle2, "SAT", ts)
    t0 = ts.now()
    t1 = ts.from_datetime(t0.utc_datetime() + timedelta(hours=24))

    results = {}
    for gs in req.stations:
        observer = wgs84.latlon(gs.lat, gs.lng, elevation_m=gs.hgt_m)
        times, evs = sat.find_events(observer, t0, t1, altitude_degrees=0.0)

        # Current elevation
        diff = sat - observer
        topocentric = diff.at(t0)
        alt, _, _ = topocentric.altaz()
        elevation_now = alt.degrees

        aos = los = None
        if elevation_now > 0:
            # In pass: AOS = now, LOS = next set event
            aos = t0.utc_datetime().isoformat()
            for ti, ev in zip(times, evs):
                if ev == 2:
                    los = ti.utc_datetime().isoformat()
                    break
        else:
            # Next upcoming pass
            for ti, ev in zip(times, evs):
                if ev == 0 and aos is None:
                    aos = ti.utc_datetime().isoformat()
                elif ev == 2 and aos is not None:
                    los = ti.utc_datetime().isoformat()
                    break

        results[gs.name] = {"aos": aos, "los": los}

    return results

# ---------- Disable Caching ----------
@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.endswith((".html", ".js", ".css", ".json")):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response

# ---------- Static Files ----------
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# ---------- Local Run ----------
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))  # Render provides PORT
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
