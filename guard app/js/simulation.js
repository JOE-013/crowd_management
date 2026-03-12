/**
 * simulation.js — Data Layer for CrowdAI Guard
 * ─────────────────────────────────────────────
 * Tries to fetch live data from your AWS App Runner backend.
 * Falls back to built-in simulation if API is unreachable.
 *
 * TO CONNECT YOUR AWS BACKEND:
 *   Set API_BASE to your App Runner URL, e.g.:
 *   const API_BASE = "https://xxxxxxxxxx.us-east-1.awsapprunner.com";
 */

const API_BASE = "";  // ← PASTE YOUR APP RUNNER URL HERE (leave empty for simulation)

// ── Zone metadata ──────────────────────────────────────────────────────────
const ZONE_META = {
  Zone_A: { name: "Zone A", desc: "Main Entrance — Gate 1–4" },
  Zone_B: { name: "Zone B", desc: "Middle Concourse — Gate 5–8" },
  Zone_C: { name: "Zone C", desc: "Lower Level — Field Side" },
};

// ── Simulation scenario data ───────────────────────────────────────────────
// Mirrors the Python simulate_data.py patterns in JS
function buildProfile(scenario) {
  const points = 120;
  const zones = {};

  if (scenario === "normal") {
    zones.Zone_A = { densities: [], velocities: [] };
    zones.Zone_B = { densities: [], velocities: [] };
    zones.Zone_C = { densities: [], velocities: [] };
    for (let i = 0; i < points; i++) {
      const t = i / points;
      // Zone A: mild bump around t=0.35
      const dA = 1.0 + Math.sin(t * Math.PI * 2) * 0.8 + (t > 0.3 && t < 0.55 ? 2.5 * Math.sin((t-0.3)/0.25*Math.PI) : 0) + noise(0.15);
      const vA = 1.6 - (t > 0.3 && t < 0.55 ? 0.8 * Math.sin((t-0.3)/0.25*Math.PI) : 0) + noise(0.08);
      zones.Zone_A.densities.push(Math.max(0.3, Math.min(10, dA)));
      zones.Zone_A.velocities.push(Math.max(0.1, Math.min(2, vA)));
      // Zone B: quiet
      zones.Zone_B.densities.push(Math.max(0.3, 0.8 + noise(0.2)));
      zones.Zone_B.velocities.push(Math.max(0.1, 1.7 + noise(0.1)));
      // Zone C: steady
      zones.Zone_C.densities.push(Math.max(0.3, 0.6 + Math.sin(t * 4 * Math.PI) * 0.25 + noise(0.1)));
      zones.Zone_C.velocities.push(Math.max(0.1, 1.7 - Math.sin(t * 4 * Math.PI) * 0.12 + noise(0.06)));
    }
  }

  if (scenario === "rush") {
    zones.Zone_A = { densities: [], velocities: [] };
    zones.Zone_B = { densities: [], velocities: [] };
    zones.Zone_C = { densities: [], velocities: [] };
    for (let i = 0; i < points; i++) {
      const t = i / points;
      // Zone A spikes first
      const rampA = clamp((t - 0.05) / 0.35, 0, 1);
      zones.Zone_A.densities.push(clamp(2.5 + rampA * 6.0 + noise(0.3), 0.5, 10));
      zones.Zone_A.velocities.push(clamp(1.4 - rampA * 1.32 + noise(0.1), 0.05, 2));
      // Zone B cascades later
      const rampB = clamp((t - 0.15) / 0.35, 0, 1);
      zones.Zone_B.densities.push(clamp(2.0 + rampB * 5.5 + noise(0.3), 0.5, 10));
      zones.Zone_B.velocities.push(clamp(1.5 - rampB * 1.38 + noise(0.1), 0.05, 2));
      // Zone C last
      const rampC = clamp((t - 0.25) / 0.35, 0, 1);
      zones.Zone_C.densities.push(clamp(1.5 + rampC * 4.5 + noise(0.25), 0.5, 10));
      zones.Zone_C.velocities.push(clamp(1.6 - rampC * 1.45 + noise(0.1), 0.05, 2));
    }
  }

  if (scenario === "emergency") {
    zones.Zone_A = { densities: [], velocities: [] };
    zones.Zone_B = { densities: [], velocities: [] };
    zones.Zone_C = { densities: [], velocities: [] };
    for (let i = 0; i < points; i++) {
      const t = i / points;
      const spike = clamp((t - 0.02) / 0.12, 0, 1);
      zones.Zone_A.densities.push(clamp(3.5 + spike * 6.3 + noise(0.4), 0.5, 10));
      zones.Zone_A.velocities.push(clamp(1.0 - spike * 0.98 + noise(0.1), 0.02, 2));
      zones.Zone_B.densities.push(clamp(3.0 + spike * 6.5 + noise(0.4), 0.5, 10));
      zones.Zone_B.velocities.push(clamp(1.2 - spike * 1.18 + noise(0.1), 0.02, 2));
      zones.Zone_C.densities.push(clamp(2.5 + spike * 6.5 + noise(0.35), 0.5, 10));
      zones.Zone_C.velocities.push(clamp(1.4 - spike * 1.38 + noise(0.1), 0.02, 2));
    }
  }

  return zones;
}

function noise(scale) { return (Math.random() - 0.5) * scale * 2; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── State ──────────────────────────────────────────────────────────────────
const SimState = {
  step: 0,
  scenario: "normal",
  profile: null,
  zones: {},          // { Zone_A: {density, velocity, risk, prob, ttc, msg, history}, ... }
  useApi: !!API_BASE,
  prevRisk: {},       // track risk level changes for auto-heatmap trigger
};

// Pre-seeded random profiles per scenario (build once)
const PROFILES = {};
function ensureProfile(s) {
  if (!PROFILES[s]) PROFILES[s] = buildProfile(s);
  return PROFILES[s];
}

// ── Risk calculation ───────────────────────────────────────────────────────
function calcRisk(density, velocity) {
  const prob = (density / 10) * 0.6 + (1 - clamp(velocity / 2, 0, 1)) * 0.4;
  const level = prob >= 0.7 ? "red" : prob >= 0.4 ? "yellow" : "green";
  let ttc = 0;
  if (level === "red")    ttc = Math.max(2, Math.min(8, Math.round((1 - prob) * 20)));
  if (level === "yellow") ttc = Math.max(9, Math.min(15, Math.round((1 - prob) * 30)));
  if (level === "green")  ttc = Math.max(15, Math.min(60, Math.round(60 - prob * 100)));
  return { prob: clamp(prob, 0, 1), level, ttc };
}

function signageMsg(zone, level, ttc) {
  const msgs = {
    red:    `⚠️ ${zone}: Congestion in ~${ttc} min. Redirect crowd via alternate exit NOW.`,
    yellow: `⚡ ${zone} getting busy. Stewards on standby. Est. ${ttc} min to peak.`,
    green:  `✅ ${zone} is clear. Normal crowd flow.`,
  };
  return msgs[level];
}

// ── Tick: update zone data ─────────────────────────────────────────────────
async function simTick() {
  const prevRiskSnap = {};
  for (const z of Object.keys(ZONE_META)) {
    prevRiskSnap[z] = SimState.zones[z]?.level || "green";
  }

  if (SimState.useApi) {
    try {
      // Advance backend simulation
      await fetch(`${API_BASE}/api/tick`, { method: "POST" });
      const res  = await fetch(`${API_BASE}/api/data`);
      const data = await res.json();
      parseApiData(data);
    } catch (e) {
      console.warn("API unreachable, switching to simulation:", e);
      SimState.useApi = false;
      tickSimulation();
    }
  } else {
    tickSimulation();
  }

  detectRiskTransitions(prevRiskSnap);
}

function parseApiData(data) {
  for (const [zId, zData] of Object.entries(data.zones || {})) {
    const history = SimState.zones[zId]?.history || [];
    history.push(zData.density);
    if (history.length > 20) history.shift();
    SimState.zones[zId] = {
      density:  zData.density,
      velocity: zData.velocity,
      level:    zData.risk_level,
      prob:     zData.risk_probability / 100,
      ttc:      zData.time_to_congestion,
      msg:      zData.message,
      history,
    };
  }
}

function tickSimulation() {
  const profile = ensureProfile(SimState.scenario);
  const pts = profile.Zone_A.densities.length;
  SimState.step = (SimState.step + 1) % pts;

  for (const zId of Object.keys(ZONE_META)) {
    const d = profile[zId].densities[SimState.step];
    const v = profile[zId].velocities[SimState.step];
    const { prob, level, ttc } = calcRisk(d, v);

    const history = SimState.zones[zId]?.history || [];
    history.push(d);
    if (history.length > 20) history.shift();

    SimState.zones[zId] = {
      density: d,
      velocity: v,
      prob, level, ttc,
      msg: signageMsg(ZONE_META[zId].name, level, ttc),
      history,
    };
  }
}

function detectRiskTransitions(prev) {
  for (const z of Object.keys(ZONE_META)) {
    const was = prev[z] || "green";
    const now = SimState.zones[z]?.level || "green";
    if (was !== "red" && now === "red") {
      // Emit event for app.js to handle (auto-pop heatmap)
      setTimeout(() => {
        if (typeof onCriticalAlert === "function") onCriticalAlert(z);
      }, 1500);
    }
  }
}

// ── Change scenario ────────────────────────────────────────────────────────
async function setScenario(s) {
  SimState.scenario = s;
  SimState.step = 0;
  SimState.zones = {};

  if (SimState.useApi) {
    const nameMap = {
      normal: "🏢 Normal Day",
      rush:   "🎉 Post-Event Rush",
      emergency: "🚨 Emergency Evacuation",
    };
    try {
      await fetch(`${API_BASE}/api/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: nameMap[s] }),
      });
    } catch (e) { SimState.useApi = false; }
  }

  // Seed initial state immediately
  tickSimulation();
}

// ── Forecast prediction ────────────────────────────────────────────────────
function getForecast(zId) {
  const z  = SimState.zones[zId];
  if (!z) return null;

  const hist = z.history;
  const roc  = hist.length > 5
    ? (hist[hist.length - 1] - hist[hist.length - 6]) / 5
    : 0;

  const predictedDensity  = clamp(z.density + roc * 25, 0.3, 10);
  const predictedVelocity = clamp(z.velocity - roc * 0.15, 0.05, 2);
  const { prob, level, ttc } = calcRisk(predictedDensity, predictedVelocity);

  const trend = roc > 0.05 ? "up" : roc < -0.05 ? "down" : "same";
  const confidence = clamp(Math.abs(roc) * 40 + 45, 30, 95);

  return { predictedDensity, predictedVelocity, prob, level, ttc, trend, confidence };
}

// ── AI Situation Brief (template-based, no API needed) ────────────────────
function getAIBrief() {
  const rising = [];
  const critical = [];

  for (const [zId, z] of Object.entries(SimState.zones)) {
    const f = getForecast(zId);
    if (!f) continue;
    if (f.level === "red")    critical.push(ZONE_META[zId].name);
    else if (f.trend === "up") rising.push(ZONE_META[zId].name);
  }

  if (critical.length === 3)
    return "All three zones are forecasted critical — this is an emergency pattern. Activate full stadium crowd control protocol immediately and begin systematic evacuation procedures.";

  if (critical.length > 0)
    return `${critical.join(" and ")} ${critical.length > 1 ? "are" : "is"} forecast to reach critical congestion within 15 minutes. ${rising.length > 0 ? rising.join(", ") + " also showing rising density trends." : "Other zones remain stable."} Dispatch teams to critical zones now.`;

  if (rising.length > 0)
    return `${rising.join(" and ")} ${rising.length > 1 ? "are" : "is"} showing a rising density trend. No critical thresholds forecast yet, but stewards should monitor closely over the next 10 minutes.`;

  return "All zones are stable with no significant congestion forecast in the next 15 minutes. Continue routine monitoring.";
}

// ── Load AI brief from Bedrock (optional, if API connected) ───────────────
async function loadAIBriefFromBackend() {
  if (!SimState.useApi) return null;
  try {
    const res = await fetch(`${API_BASE}/api/overview`);
    const data = await res.json();
    return data.overview || null;
  } catch { return null; }
}
