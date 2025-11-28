// External libs
import * as d3       from 'https://cdn.skypack.dev/d3@7';
import * as topojson from 'https://cdn.skypack.dev/topojson-client@3';
import {
  getGroundTracks,
  getLatLngObj,
  getSatelliteInfo,
} from 'https://cdn.skypack.dev/tle.js@latest';

// Config / State
const stepMS = 1000;
const COLORS = d3.schemeCategory10;
let extraOrbits = new Map();  // for non-primary sats in a formation


const MISSION_INFO = {
  'DUTHSat-2': {
    title: 'DUTHSat-2',
    html: `
    <p class="sat-blurb">
      A 6U CubeSat for multispectral (visible + near-IR) Earth observation over sea and land.
      Imagery bands and resolution are selected to detect oil spills and ship bilge water, and
      to infer soil moisture over land. Includes an in-orbit demo of an Essential Telemetry
      & Housekeeping Module.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> 6U CubeSat</li>
      <li><span class="label">Prime:</span> Democritus University of Thrace</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> June 2025</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>Oil-slick & marine contamination detection</li>
        <li>Agricultural monitoring (soil moisture)</li>
        <li>In-orbit demo of Essential Telemetry & Housekeeping unit</li>
      </ul>
    </div>
    `
  },
  'PHASMA': {
    title: 'PHASMA',
    html: `
    <p class="sat-blurb">
      PHASMA consists of two identical 3U CubeSats, LAMARR and DIRAC, flying in close proximity to detect and
      monitor RF signals in UHF and S-band from space or ground-based sources. Each platform carries a SatNOGS-COMMS transceiver,
      payload antenna, and a SIDLOC unit for autonomous LEO satellite identification and tracking.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> Two 3U CubeSats</li>
      <li><span class="label">Prime:</span> Libre Space Foundation</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> November 2025</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>Space-Based SSA via RF monitoring in UHF & S-band</li>
        <li>Monitoring terrestrial RF transmissions</li>
        <li>Demonstration of SIDLOC satellite identification system</li>
      </ul>
    </div>
    `
  },
  'MICE-1': {
    title: 'MICE-1',
    html: `
    <p class="sat-blurb">
      MICE-1 (Maritime Identification and Communication systEm – 1) is a 3U CubeSat supporting advanced maritime tracking
      in the Mediterranean. Its primary payload receives, stores, and downlinks AIS signals from ships, while its secondary
      payload enables IoT data packet exchange as part of the Prisma-developed LAROS remote monitoring system.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> 3U CubeSat</li>
      <li><span class="label">Prime:</span> Prisma Electronics SA</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> November 2025</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>Enhanced ship tracking through AIS reception</li>
        <li>LAROS IoT data exchange for remote condition monitoring</li>
        <li>Support for advanced system diagnostics & environmental assessment</li>
      </ul>
    </div>
    `
  },
  'PeakSat': {
    title: 'PeakSat',
    html: `
    <p class="sat-blurb">
      PeakSat is a 3U CubeSat developed to support the Hellas Quantum Communications Initiative (QCI). 
      Its main focus is to demonstrate in-orbit laser-optical links with the Holomondas Optical Ground Station (OGS), 
      led by Aristotle University of Thessaloniki. The mission will test optical communications scenarios under 
      varying elevations and weather conditions, and validate in-house OBC and COMMS subsystems.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> 3U CubeSat</li>
      <li><span class="label">Prime:</span> Aristotle University of Thessaloniki</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> February 2026</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>IOD of laser-optical link with Holomondas OGS</li>
        <li>IOV of AUTH-developed OBC & COMMS hardware/software</li>
        <li>Establish indirect optical link between Holomondas and other OGSs</li>
      </ul>
    </div>
    `
  },

  'OptiSat': {
    title: 'OptiSat',
    html: `
    <p class="sat-blurb">
      OptiSat is a 6U CubeSat by Planetek Hellas for in-orbit validation of secure optical communications 
      and space-based data processing. It will demonstrate high-speed laser links with Optical Ground Stations, 
      while testing onboard processing of multi/hyperspectral imaging data with autonomous cloud detection, 
      compression, and encryption capabilities.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> 6U CubeSat</li>
      <li><span class="label">Prime:</span> Planetek Hellas</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> February 2026</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>Demonstrate autonomous high-speed optical downlinks (DTE)</li>
        <li>Validate Cognitive Cloud Computing in Space (C3S)</li>
        <li>Validate OP3C compression on simulated hyperspectral data</li>
      </ul>
    </div>
    `
  },

  'Hellenic Space Dawn': {
    title: 'Hellenic Space Dawn',
    html: `
    <p class="sat-blurb">
      Hellenic Space Dawn consists of two 8U CubeSats, Helios and Selene, 
      carrying imaging payloads, optical communications terminals, and advanced onboard processors. 
      The mission supports cartography, agriculture, and forestry applications while demonstrating 
      secure inter-satellite links and a hardened microcontroller library.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> Two 8U CubeSats</li>
      <li><span class="label">Prime:</span> EMTech SPACE</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> February 2026</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>EO imagery for cartography, agriculture, and forestry</li>
        <li>IOV of advanced processor & hardened mixed-signal library</li>
        <li>Secure connectivity via inter-satellite link</li>
        <li>Demonstration of optical communications</li>
      </ul>
    </div>
    `
  },

  'ERMIS': {
    title: 'ERMIS',
    html: `
    <p class="sat-blurb">
      ERMIS is a three-satellite constellation: two 6U CubeSats (ERMIS 1 & 2) focusing on IoT communications 
      and inter-satellite links, and one 8U CubeSat (ERMIS 3) hosting a hyperspectral imager and a laser-optical terminal. 
      The mission aims to provide secure connectivity and demonstrate space-based 5G IoT services and precision agriculture applications.
    </p>

    <ul class="sat-kv">
      <li><span class="label">Dimension:</span> Two 6U CubeSats + One 8U CubeSat</li>
      <li><span class="label">Prime:</span> National and Kapodistrian University of Athens (NKUA)</li>
      <li><span class="label">Orbit:</span> 510 km SSO</li>
      <li><span class="label">Launch Date:</span> February 2026</li>
    </ul>
    </br>

    <div class="sat-section">
      <strong>Mission Objectives:</strong>
      <ul class="sat-list">
        <li>Demonstrate space-based 5G IoT services with ISL</li>
        <li>Secure connectivity via optical link</li>
        <li>Hyperspectral imaging for precision agriculture</li>
      </ul>
    </div>
    `
  }

};

//  Mission logos 
const MISSION_LOGOS = {
  'DUTHSat-2': 'duth.png',
  'PHASMA': 'phasma.png',
  'MICE-1': 'mice.png',
  'PeakSat': 'peaksat.png',
  'OptiSat': 'optisat.png',
  'Hellenic Space Dawn': 'hsd.png',
  'ERMIS': 'ermis.png'
};


const SAT_LIST = [
  // Single satellites
{
   name: 'DUTHSat-2',
   missionType: 'single',
   noradId: null,     // no NORAD yet
   manualTle: `1 64532U 25135E   25267.31645216  .00019005  00000-0  92304-3 0  9992
2 64532  97.4549  20.3503 0005468  29.9791 330.1755 15.18487677 14466`,
   stations: [
     { name: 'Greece (DUTH)',     lat: 41.1419, lng: 24.8900,  hgtKm: 0.076 },
   ],
 },
{
    name: 'MICE-1',
    missionType: 'single',
    noradId: null,
    manualTle: `1 00000U 00000A   25332.80200264  .00000000  00000+0  00000+0 0  19
2 00000  97.4391  38.1885  0001420  59.9253 290.0519 15.17663614 04`,
    stations: [
      { name: 'Greece (DUTH)', lat: 41.1419, lng: 24.8900, hgtKm: 0.076 },
      { name: 'Chile', lat: -53.041222, lng: -70.847111, hgtKm: 0.0 },
      { name: 'Azerbaijan', lat: 40.467464, lng: 49.488045, hgtKm: 0.0 },
      { name: 'Sri Lanka', lat: 7.274583, lng: 80.724972, hgtKm: 0.0 },
      { name: 'South Africa', lat: -25.860333, lng: 28.453777, hgtKm: 0.0 },
      { name: 'Mauritius', lat: -20.5014, lng: 57.4506, hgtKm: 0.0 },
      { name: 'Norway', lat: 78.2244, lng: 15.395169, hgtKm: 0.0 },
      { name: 'Iceland', lat: 65.647361, lng: -20.244417, hgtKm: 0.0 },
      { name: 'New Zealand', lat: -46.528056, lng: 168.378972, hgtKm: 0.0 },
      { name: 'Portugal', lat: 36.997361, lng: -25.137333, hgtKm: 0.0 },
      { name: 'United Kingdom', lat: 60.748389, lng: -0.858417, hgtKm: 0.0 },
    ],
  },
  // Formation example
  {
    name: 'PHASMA',
    missionType: 'formation',
    currentSatellite: 'primary',
    satellites: [
      { name: 'LAMARR',
        noradId: null,
        role: 'primary',
        manualTle: `1 00000U 00000A   25332.80257208  .00000000  00000-0  00000+0 0  19
2 00000  97.4389  38.1891 0001412  60.6914 292.3934 15.17674854 06`},
      { name: 'DIRAC',
        noradId: null,
        role: 'secondary',
        manualTle: `1 00000U 00000A   25332.80269940  .00000000  00000-0  00000+0 0  15
2 00000  97.4388  38.1892 0001406  61.4564 292.3237 15.17677228 03`},
    ],
    stations: [
      { name: 'Athens',   lat: 37.98381, lng: 23.72754,  hgtKm: 0.0 },
      { name: 'Kalamata', lat: 37.0389, lng: 22.1140, hgtKm: 0.0 },
      { name: 'Crete',     lat: 35.3387, lng: 25.1442,  hgtKm: 0.076 },
    ],
  },
{
  name: 'PeakSat',
  missionType: 'single',
  noradId: null,     // no NORAD yet
  plannedLaunch: 'February 2026',   // <-- add this
  stations: [],                     // can leave empty for now
},
{
  name: 'OptiSat',
  missionType: 'single',
  noradId: null,     // no NORAD yet
  plannedLaunch: 'February 2026',   // <-- add this
  stations: [],                     // can leave empty for now
},
{
  name: 'Hellenic Space Dawn',
  missionType: 'single',
  noradId: null,     // no NORAD yet
  plannedLaunch: 'February 2026',   // <-- add this
  stations: [],                     // can leave empty for now
},
{
  name: 'ERMIS',
  missionType: 'single',
  noradId: null,     // no NORAD yet
  plannedLaunch: 'February 2026',   // <-- add this
  stations: [],                     // can leave empty for now
}


];


let currentSat = SAT_LIST[0]; // mission (single or formation)
let orbits     = null;        // precomputed [past, current, future]
let tleDb      = null;        // JSON loaded from /tle_data.json

// ──────────────────────────────────────────────────────────────────────────────
// Utilities

function fmtUTC(iso) {
  return iso ? iso.slice(0, 19).replace('T', ' ') + ' UTC' : '—';
}

function getActiveSat() {
  if (currentSat.missionType === 'single') {
    return { name: currentSat.name, noradId: currentSat.noradId, tle: currentSat.tle };
  }
  const s = currentSat.satellites.find(x => x.role === currentSat.currentSatellite);
  return s ? { name: s.name, noradId: s.noradId, tle: s.tle } : null;
}

async function fetchAllPasses(tle, stations) {
  if (!tle) return {};
  const [tle1, tle2] = tle.trim().split('\n');
  const res = await fetch('/next_pass_all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tle1,
      tle2,
      stations: stations.map(gs => ({
        name: gs.name, lat: gs.lat, lng: gs.lng, hgt_m: gs.hgtKm * 1000
      })),
    }),
  });
  if (!res.ok) {
    console.error('Pass API error', res.status, await res.text());
    return {};
  }
  return res.json();
}

function splitAtDateline(coords) {
  const segs = [], seg = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const [lon, lat] = coords[i], [plon] = coords[i - 1];
    if (Math.abs(lon - plon) > 180) segs.push(seg.splice(0, seg.length));
    seg.push([lon, lat]);
  }
  segs.push(seg);
  return segs;
}

// ──────────────────────────────────────────────────────────────────────────────
// TLE loading (from tle_fetcher.py output)

async function loadTleDb() {
  // Cache-bust so edits/updates show immediately
  const res = await fetch('tle_data.json?ts=' + Date.now());
  if (!res.ok) throw new Error('Failed to load tle_data.json');
  const db = await res.json();
  return db;
}

function assignTlesFromDb(db) {
  const get = norad => db?.satellites?.[norad]?.tle || null;

  SAT_LIST.forEach(m => {
    if (m.missionType === 'single') {
      m.tle = get(m.noradId) || m.manualTle || null;
    } else {
      m.satellites.forEach(s => {
        s.tle = get(s.noradId) || s.manualTle || null;
      });
    }
  });
}


// ──────────────────────────────────────────────────────────────────────────────
/** UI: selectors, GS cards, info */
function populateSatelliteDropdown() {
  const select = document.getElementById('sat-select-styled');
  select.innerHTML = '';
  SAT_LIST.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = m.name;
    select.appendChild(opt);
  });
}


function renderStationCards() {
  const wrap = document.querySelector('.sv-stations');
  wrap.innerHTML = '';
  currentSat.stations.forEach((gs, i) => {
    const card = document.createElement('div');
    card.className = 'station-card';
    card.dataset.gsIndex = i;
    card.innerHTML = `
      <h2>${gs.name}</h2>
      ${currentSat.missionType === 'formation' ? `<div>Next pass by: <span class="pass-sat">—</span></div>` : ''}
      <div>Next AOS: <span class="aos">—</span></div>
      <div>Next LOS: <span class="los">—</span></div>
      <div>Elevation: <span class="el">—</span>°</div>
      <div>Azimuth:   <span class="az">—</span>°</div>
      <div>Range:     <span class="ran">—</span> km</div>
      <div>Velocity:  <span class="vel">—</span> km/s</div>
    `;
    wrap.appendChild(card);
  });
}

function renderInfoPanel() {
  const panel = document.getElementById('satellite-info');
  const name  = currentSat.name;
  const info  = MISSION_INFO[name];
  const logo  = MISSION_LOGOS[name] || 'placeholder_logo.png';

  // Base mission info
  if (info) {
    panel.innerHTML = `
      <div class="satellite-info-card">
        <h2>${info.title}</h2>
        ${info.html}
        <div class="mission-logo-container">
          <img src="${logo}" alt="${info.title} Logo" class="mission-logo" />
        </div>
      </div>
    `;
  } else {
    panel.innerHTML = `
      <div class="satellite-info-card">
        <h2>${name}</h2>
        <p>Mission details coming soon…</p>
        <div class="mission-logo-container">
          <img src="placeholder_logo.png" alt="${name} Logo" class="mission-logo" />
        </div>
      </div>
    `;
  }
}



// ──────────────────────────────────────────────────────────────────────────────
// D3 Map
const svg     = d3.select('#map');
const wrapper = document.querySelector('.sv-map');
const W       = wrapper.clientWidth;
const H       = wrapper.clientHeight;
svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

const projection = d3.geoEquirectangular().fitExtent([[0, 0], [W, H]], { type: 'Sphere' });
const pathGen    = d3.geoPath(projection);

async function drawBaseMap() {
  const world = await d3.json('https://unpkg.com/world-atlas@2.0.2/countries-110m.json');
  const land  = topojson.feature(world, world.objects.land);

  svg.append('path').datum({ type: 'Sphere' })
    .attr('fill', '#b2d6ef').attr('d', pathGen);

  svg.append('path').datum(land)
    .attr('fill', '#f5f7fa').attr('stroke', '#003a7a').attr('stroke-width', 0.5)
    .attr('d', pathGen);

  svg.append('path').attr('class', 'track-current')
    .attr('fill', 'none').attr('stroke', 'red').attr('stroke-width', 1.5);

  svg.append('path').attr('class', 'track-future')
    .attr('fill', 'none').attr('stroke', 'red').attr('stroke-width', 1.5)
    .attr('stroke-dasharray', '6,4');

  svg.append('circle').attr('class', 'sat')
    .attr('r', 6).attr('fill', 'yellow')
    .attr('stroke', '#333').attr('stroke-width', 1);
}

function renderStationDots() {
  // Small equilateral triangle symbol
  const tri = d3.symbol().type(d3.symbolTriangle).size(20);

  const dots = svg.selectAll('path.gs-dot')
    .data(currentSat.stations, d => d.name);

  dots.enter()
    .append('path')
      .attr('class', 'gs-dot')
      .attr('fill', 'red')
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.1)
    .merge(dots)
      .attr('d', tri)
      .attr('transform', d => {
        const [x, y] = projection([d.lng, d.lat]);
        return `translate(${x},${y})`;
      });

  dots.exit().remove();
}


// ──────────────────────────────────────────────────────────────────────────────
// Orbits + Update loop

async function preloadOrbits() {
  if (currentSat.missionType === 'formation') {
    // For constellations, compute tracks for *all* sats
    extraOrbits.clear();
    for (const s of currentSat.satellites) {
      if (!s.tle) continue;
      const tracks = await getGroundTracks({
        tle: s.tle,
        startTimeMS: Date.now(),
        stepMS,
        isLngLatFormat: true,
      });
      extraOrbits.set(s.name, tracks);
    }
    // no need to set "orbits" in formation mode
    return;
  }

  // ── Single satellite ──
  const active = getActiveSat();
  if (!active || !active.tle) { 
    orbits = null; 
    return; 
  }
  extraOrbits.clear();
  orbits = await getGroundTracks({
    tle: active.tle,
    startTimeMS: Date.now(),
    stepMS,
    isLngLatFormat: true,
  });
}



async function update() {
  const now = Date.now();

  // ── Handle planned (no TLE) satellites ──
  if (!currentSat.tle && !currentSat.satellites) {
    // Hide map, summary, and GS sections
    document.querySelector('.sv-map').style.display = 'none';
    document.querySelector('.sv-summary').style.display = 'none';
    document.querySelector('.sv-stations').style.display = 'none';

    // Show launch message
    const msg = document.getElementById('launch-message');
    if (msg) {
      msg.style.display = 'block';
      msg.textContent = `Launching in ${currentSat.plannedLaunch || 'TBD'}`;
    }

    // Clear times
    document.getElementById('utc-time').textContent = '';
    document.getElementById('local-time').textContent = '';

    // Clear legend if present
    const legend = document.getElementById('legend');
    if (legend) legend.innerHTML = '';

    return;
  }

  // ── Reset view for satellites with real TLEs ──
  document.querySelector('.sv-map').style.display = 'block';
  document.querySelector('.sv-summary').style.display = 'grid';
  document.querySelector('.sv-stations').style.display = 'grid';
  const msg = document.getElementById('launch-message');
  if (msg) msg.style.display = 'none';

  // clear leftovers when not in formation
  if (currentSat.missionType !== 'formation') {
    svg.selectAll('g.extra-sat').remove();
  }

  // ── Formation branch ──
  if (currentSat.missionType === 'formation') {
    const sats = currentSat.satellites.filter(s => s.tle);
    if (!sats.length || extraOrbits.size === 0) return;

    // hide default single-sat visuals
    svg.select('path.track-current').style('display', 'none');
    svg.select('path.track-future').style('display', 'none');
    svg.select('circle.sat').style('display', 'none');

    // draw all satellites in color
    const groupJoin = svg.selectAll('g.extra-sat').data(sats, d => d.name);
    const gEnter = groupJoin.enter().append('g').attr('class','extra-sat');
    gEnter.append('path').attr('class','track-current').attr('fill','none').attr('stroke-width',1.5);
    gEnter.append('path').attr('class','track-future').attr('fill','none').attr('stroke-width',1.5).attr('stroke-dasharray','6,4');
    gEnter.append('circle').attr('class','sat-dot').attr('r',6).attr('stroke','#333').attr('stroke-width',1);

    const merged = gEnter.merge(groupJoin);
    merged.each(function(d,i){
      const color = COLORS[i % COLORS.length];
      const tracks = extraOrbits.get(d.name);
      if (!tracks) return;
      const [,current,future] = tracks;

      d3.select(this).select('path.track-current')
        .attr('stroke', color)
        .datum({type:'MultiLineString', coordinates:splitAtDateline(current)})
        .attr('d', pathGen);

      d3.select(this).select('path.track-future')
        .attr('stroke', color)
        .datum({type:'MultiLineString', coordinates:splitAtDateline(future)})
        .attr('d', pathGen);

      const {lat,lng} = getLatLngObj(d.tle, now);
      const [x,y] = projection([lng,lat]);
      d3.select(this).select('circle.sat-dot')
        .attr('fill', color)
        .attr('cx', x).attr('cy', y);
    });
    groupJoin.exit().remove();

    // update times
    document.getElementById('utc-time').textContent =
      new Date(now).toLocaleTimeString('en-GB',{timeZone:'UTC'}) + ' UTC';
    document.getElementById('local-time').textContent =
      new Date(now).toLocaleTimeString('en-GB') + ' LOCAL';

    // lat/lng of all sats in formation
    let latHtml = '';
    let lngHtml = '';
    sats.forEach((s) => {
      const { lat, lng } = getLatLngObj(s.tle, now);
      latHtml += `${s.name}: ${lat.toFixed(2)}°<br>`;
      lngHtml += `${s.name}: ${lng.toFixed(2)}°<br>`;
    });
    document.getElementById('lat').innerHTML = latHtml;
    document.getElementById('lng').innerHTML = lngHtml;

    // fetch passes
    const passTimesBySat = {};
    for (const s of sats) {
      passTimesBySat[s.name] = await fetchAllPasses(s.tle, currentSat.stations);
    }

    // update GS cards
    currentSat.stations.forEach((gs, i) => {
      const card = document.querySelector(`.station-card[data-gs-index="${i}"]`);
      if (!card) return;

      let bestSat = null;
      let bestAos = null;
      let bestLos = null;

      for (const s of sats) {
        const times = passTimesBySat[s.name][gs.name] || {};
        if (times.aos && (!bestAos || new Date(times.aos) < new Date(bestAos))) {
          bestSat = s;
          bestAos = times.aos;
          bestLos = times.los;
        }
      }

      const aosEl = card.querySelector('.aos');
      const losEl = card.querySelector('.los');
      const satEl = card.querySelector('.pass-sat');

      if (bestSat && bestSat.tle) {
        const info = getSatelliteInfo(bestSat.tle, now, gs.lat, gs.lng, gs.hgtKm);
        card.querySelector('.el').textContent  = info.elevation.toFixed(2);
        card.querySelector('.az').textContent  = info.azimuth.toFixed(2);
        card.querySelector('.ran').textContent = info.range.toFixed(0);
        card.querySelector('.vel').textContent = info.velocity.toFixed(3);

        if (bestLos) {
          if (info.elevation > 0) {
            aosEl.textContent = 'PASS IN PROGRESS';
            aosEl.classList.add('in-pass');
            losEl.textContent = fmtUTC(bestLos);
          } else {
            aosEl.textContent = fmtUTC(bestAos);
            aosEl.classList.remove('in-pass');
            losEl.textContent = fmtUTC(bestLos);
          }
        }
      } else {
        card.querySelector('.el').textContent  = '—';
        card.querySelector('.az').textContent  = '—';
        card.querySelector('.ran').textContent = '—';
        card.querySelector('.vel').textContent = '—';
        aosEl.textContent = '—';
        losEl.textContent = '—';
      }

      if (satEl) satEl.textContent = bestSat ? bestSat.name : '—';
    });

    renderStationDots();

    // legend
    const legend = document.getElementById('legend');
    if (legend) {
      legend.innerHTML = '';
      sats.forEach((s, i) => {
        const color = COLORS[i % COLORS.length];
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `<span class="legend-color" style="background:${color}"></span>${s.name}`;
        legend.appendChild(item);
      });
    }

    return;
  }

  // ── Single-satellite branch ──
  if (!orbits) return;
  const active = getActiveSat();
  if (!active || !active.tle) return;

  svg.select('path.track-current').style('display', null);
  svg.select('path.track-future').style('display', null);
  svg.select('circle.sat').style('display', null);

  const [,current,future] = orbits;
  const color = COLORS[0];

  svg.select('path.track-current')
    .attr('stroke', color)
    .datum({ type:'MultiLineString', coordinates:splitAtDateline(current) })
    .attr('d', pathGen);

  svg.select('path.track-future')
    .attr('stroke', color)
    .datum({ type:'MultiLineString', coordinates:splitAtDateline(future) })
    .attr('d', pathGen);

  const {lat,lng} = getLatLngObj(active.tle, now);
  const [x,y] = projection([lng,lat]);
  svg.select('circle.sat')
    .attr('fill', color)
    .attr('cx', x).attr('cy', y);

  document.getElementById('utc-time').textContent =
    new Date(now).toLocaleTimeString('en-GB',{timeZone:'UTC'}) + ' UTC';
  document.getElementById('local-time').textContent =
    new Date(now).toLocaleTimeString('en-GB') + ' LOCAL';
  document.getElementById('lat').textContent = lat.toFixed(2) + '°';
  document.getElementById('lng').textContent = lng.toFixed(2) + '°';

  currentSat.stations.forEach((gs, i) => {
    const info = getSatelliteInfo(active.tle, now, gs.lat, gs.lng, gs.hgtKm);
    const card = document.querySelector(`.station-card[data-gs-index="${i}"]`);
    if (!card) return;
    card.querySelector('.el').textContent  = info.elevation.toFixed(2);
    card.querySelector('.az').textContent  = info.azimuth.toFixed(2);
    card.querySelector('.ran').textContent = info.range.toFixed(0);
    card.querySelector('.vel').textContent = info.velocity.toFixed(3);
  });

  const passTimes = await fetchAllPasses(active.tle, currentSat.stations);
  currentSat.stations.forEach((gs, i) => {
    const card = document.querySelector(`.station-card[data-gs-index="${i}"]`);
    if (!card) return;
    const times = passTimes[gs.name] || {};
    const elev  = getSatelliteInfo(active.tle, now, gs.lat, gs.lng, gs.hgtKm).elevation;
    const aosEl = card.querySelector('.aos');
    const losEl = card.querySelector('.los');
    if (elev > 0 && times.los) {
      aosEl.textContent = 'PASS IN PROGRESS';
      aosEl.classList.add('in-pass');
      losEl.textContent = fmtUTC(times.los);
    } else {
      aosEl.textContent = fmtUTC(times.aos);
      aosEl.classList.remove('in-pass');
      losEl.textContent = fmtUTC(times.los);
    }
  });

  renderStationDots();

  const legend = document.getElementById('legend');
  if (legend) legend.innerHTML = '';
}




// ──────────────────────────────────────────────────────────────────────────────
// Event handlers

async function handleSatelliteChange(index) {
  currentSat = SAT_LIST[Number(index)] || currentSat;
  renderStationCards();
  renderInfoPanel(); 
  await preloadOrbits();
}


// ──────────────────────────────────────────────────────────────────────────────
// Init

(async function init() {
  tleDb = await loadTleDb();
  assignTlesFromDb(tleDb);

  populateSatelliteDropdown();
  renderInfoPanel();
  renderStationCards();

  await drawBaseMap();
  await preloadOrbits();

  update();
  setInterval(update, 1000);

  const mainSel = document.getElementById('sat-select-styled');
  if (mainSel) mainSel.addEventListener('change', e => handleSatelliteChange(e.target.value));

  console.log('✅ Satellite tracker ready (using tle_data.json, no browser API calls).');
})();
