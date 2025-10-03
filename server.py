#  to  http://localhost:8000/tentative.html

import os
from datetime import timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from skyfield.api import load, EarthSatellite, wgs84

app = FastAPI()

# 1) CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ts = load.timescale()

# 2) Data models
class Station(BaseModel):
    name: str
    lat:  float
    lng:  float
    hgt_m: float

class PassRequest(BaseModel):
    tle1:      str
    tle2:      str
    stations: list[Station]

# 3) API endpoint for pass predictions
@app.post("/next_pass_all")
def next_pass_all(req: PassRequest):
    sat = EarthSatellite(req.tle1, req.tle2, "SAT", ts)
    t0  = ts.now()
    t1  = ts.from_datetime(t0.utc_datetime() + timedelta(hours=24))

    results = {}
    for gs in req.stations:
        observer = wgs84.latlon(gs.lat, gs.lng, elevation_m=gs.hgt_m)
        times, evs = sat.find_events(observer, t0, t1, altitude_degrees=0.0)

        # compute current elevation
        diff        = sat - observer
        topocentric = diff.at(t0)
        alt, _, _   = topocentric.altaz()
        elevation_now = alt.degrees

        aos = los = None
        if elevation_now > 0:
            # in-pass: AOS = now, LOS = first set
            aos = t0.utc_datetime().isoformat()
            for ti, ev in zip(times, evs):
                if ev == 2:
                    los = ti.utc_datetime().isoformat()
                    break
        else:
            # upcoming pass: rise then set
            for ti, ev in zip(times, evs):
                if ev == 0 and aos is None:
                    aos = ti.utc_datetime().isoformat()
                elif ev == 2 and aos is not None:
                    los = ti.utc_datetime().isoformat()
                    break

        results[gs.name] = {"aos": aos, "los": los}

    return results

# 4) Middleware and static files
@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    # strip cache for all HTML, JS, and CSS
    if request.url.path.endswith((".html", ".js", ".css", ".json")):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"]        = "no-cache"
    return response

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

# 5) Run with: python server.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)