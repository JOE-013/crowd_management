/**
 * app.js — Main UI Controller for CrowdAI Guard
 * ───────────────────────────────────────────────
 * Handles: login, tab navigation, alert cards,
 * map interaction, forecast tab, heatmap modal.
 */

// ── Auth ──────────────────────────────────────────────────────────────────
const USERS = {
  SEC001: { pin: "1234", name: "Aditya Kumar" },
  SEC002: { pin: "1234", name: "Priya Sharma" },
  SEC003: { pin: "1234", name: "Raj Singh" },
};

let currentUser = null;
let pinBuffer = "";

// Numpad
document.querySelectorAll(".num").forEach(btn => {
  btn.addEventListener("click", () => {
    const n = btn.dataset.n;
    if (n === "clear") {
      pinBuffer = pinBuffer.slice(0, -1);
    } else if (n === "enter") {
      attemptLogin();
    } else {
      if (pinBuffer.length < 4) pinBuffer += n;
    }
    document.getElementById("input-pin").value = "•".repeat(pinBuffer.length);
  });
});

document.getElementById("input-badge").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("input-pin").focus();
});

function attemptLogin() {
  const badge = document.getElementById("input-badge").value.trim().toUpperCase();
  const pin   = pinBuffer;
  const user  = USERS[badge];
  const errEl = document.getElementById("login-error");

  if (user && user.pin === pin) {
    currentUser = { badge, name: user.name };
    errEl.classList.add("hidden");
    showDashboard();
  } else {
    errEl.classList.remove("hidden");
    pinBuffer = "";
    document.getElementById("input-pin").value = "";
    // Shake animation
    const wrap = document.querySelector(".login-wrap");
    wrap.style.animation = "none";
    setTimeout(() => { wrap.style.animation = ""; }, 10);
  }
}

function showDashboard() {
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-dashboard").classList.add("active");
  document.getElementById("officer-badge").textContent = currentUser.badge;
  startApp();
}

// ── Tab Navigation ────────────────────────────────────────────────────────
let activeTab = "alerts";

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === `tab-${tab}`));
  if (tab === "forecast") renderForecastTab();
  if (tab === "map")      renderMapTab();
}

// ── Scenario select ───────────────────────────────────────────────────────
document.getElementById("scenario-select").addEventListener("change", async (e) => {
  await setScenario(e.target.value);
  renderAll();
});

// ── Main loop ─────────────────────────────────────────────────────────────
async function startApp() {
  await setScenario("normal");
  renderAll();
  setInterval(async () => {
    await simTick();
    renderAll();
  }, 3000);
}

function renderAll() {
  renderAlertCards();
  updateSummaryStrip();
  updateAIBrief();
  if (activeTab === "map")      renderMapTab();
  if (activeTab === "forecast") renderForecastTab();
  if (_animState.zoneId)        updateModalStats(_animState.zoneId);
}

// ── Callback from simulation.js when a zone goes critical ─────────────────
function onCriticalAlert(zoneId) {
  // Only auto-pop if heatmap is not already open
  if (!document.getElementById("heatmap-modal").classList.contains("hidden")) return;
  openHeatmap(zoneId, false, true);
}

// ── Summary Strip ─────────────────────────────────────────────────────────
function updateSummaryStrip() {
  let crit = 0, warn = 0, clear = 0;
  for (const z of Object.values(SimState.zones)) {
    if (z.level === "red")    crit++;
    else if (z.level === "yellow") warn++;
    else                            clear++;
  }
  document.getElementById("cnt-critical").textContent = crit;
  document.getElementById("cnt-warning").textContent  = warn;
  document.getElementById("cnt-clear").textContent    = clear;
}

// ── Alert Cards ───────────────────────────────────────────────────────────
const acknowledged = new Set(); // track acknowledged zone ids

function renderAlertCards() {
  const container = document.getElementById("alert-cards");
  const zones = Object.entries(SimState.zones)
    .sort(([, a], [, b]) => {
      const order = { red: 0, yellow: 1, green: 2 };
      return order[a.level] - order[b.level];
    });

  zones.forEach(([zId, z]) => {
    let card = document.getElementById(`card-${zId}`);
    if (!card) {
      card = document.createElement("div");
      card.id = `card-${zId}`;
      card.className = "alert-card";
      container.appendChild(card);
    }

    const meta  = ZONE_META[zId];
    const pct   = Math.round(z.prob * 100);
    const isAck = acknowledged.has(zId);
    const barColor = z.level === "red" ? "#FF3B30" : z.level === "yellow" ? "#FFB800" : "#00FF88";

    card.className = `alert-card risk-${z.level} ${isAck ? "card-acknowledged" : ""}`;

    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-zone-name">${meta.name}</div>
          <div class="card-zone-desc">${meta.desc}</div>
        </div>
        <span class="risk-badge ${z.level}">${z.level.toUpperCase()}</span>
      </div>

      <div class="card-metrics">
        <div class="metric-block">
          <span class="metric-label">Density</span>
          <span class="metric-val">${z.density.toFixed(1)}<small style="font-size:10px;color:#7d8590"> p/m²</small></span>
        </div>
        <div class="density-bar-wrap">
          <div class="density-bar-bg">
            <div class="density-bar-fill" style="width:${Math.min(100, z.density*10)}%; background:${barColor};"></div>
          </div>
          <span style="font-size:10px;color:#7d8590">${z.velocity.toFixed(2)} m/s</span>
        </div>
        <div class="prob-big ${z.level}">${pct}%</div>
      </div>

      ${z.level !== "green" && !isAck ? `
        <div class="card-bottom">
          ${z.level === "red" ? `<span class="signage-msg">${z.msg}</span>` : ""}
          <button class="btn-acknowledge" onclick="acknowledgeZone('${zId}')">Acknowledge</button>
        </div>
        ${z.level === "red" ? `
        <div class="card-bottom critical-row" style="flex-wrap:wrap">
          <button class="btn-dispatch" onclick="dispatchTeam('${zId}')">🚨 DISPATCH TEAM</button>
        </div>` : ""}
      ` : isAck ? `
        <div class="card-bottom">
          <span class="ack-stamp">✓ Ack by ${currentUser.badge}</span>
        </div>
      ` : ""}

      <div class="card-bottom" style="padding-top:4px;border-top:1px solid #2a3040">
        <button class="btn-heatmap" onclick="openHeatmap('${zId}')">🌡️ HEATMAP</button>
      </div>
    `;
  });
}

function acknowledgeZone(zId) {
  acknowledged.add(zId);
  renderAlertCards();
}

function dispatchTeam(zId) {
  const meta = ZONE_META[zId];
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  addLog(`[${time}] ${currentUser.badge} dispatched to <span class="log-zone">${meta.name}</span>`);
  acknowledged.add(zId);
  renderAlertCards();
}

function addLog(msg) {
  const log = document.getElementById("activity-log");
  const empty = log.querySelector(".log-empty");
  if (empty) empty.remove();
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.innerHTML = msg;
  log.prepend(entry);
}

// ── Map Tab ───────────────────────────────────────────────────────────────
let selectedMapZone = null;

// Attach SVG click handlers once
document.querySelectorAll(".map-zone").forEach(el => {
  el.addEventListener("click", () => {
    const zId = el.dataset.zone;
    openMapDetail(zId);
  });
});

function renderMapTab() {
  // Color SVG zones
  for (const [zId, z] of Object.entries(SimState.zones)) {
    const sfxMap = { Zone_A: "a", Zone_B: "b", Zone_C: "c" };
    const el = document.getElementById(`map-zone-${sfxMap[zId]}`);
    if (!el) continue;
    const { fill, stroke } = getZoneMapColor(z.level);
    if (el.tagName === "ellipse") {
      // For ellipses that are strokes (ring-style), color the stroke
      if (el.getAttribute("stroke-width") === "10" || el.getAttribute("stroke-width") === "14") {
        el.setAttribute("stroke", stroke);
      } else {
        // Filled zone (Zone C)
        el.setAttribute("fill", fill);
        el.setAttribute("stroke", stroke);
      }
    }
  }

  // Update open detail if visible
  if (selectedMapZone) openMapDetail(selectedMapZone);
}

function openMapDetail(zId) {
  selectedMapZone = zId;
  const z    = SimState.zones[zId];
  const meta = ZONE_META[zId];
  if (!z) return;

  document.getElementById("map-detail").classList.remove("hidden");
  document.getElementById("map-detail-title").textContent = meta.name;
  document.getElementById("dd-density").textContent  = `${z.density.toFixed(1)} p/m²`;
  document.getElementById("dd-velocity").textContent = `${z.velocity.toFixed(2)} m/s`;
  document.getElementById("dd-risk").textContent     = `${Math.round(z.prob * 100)}%`;
  document.getElementById("dd-ttc").textContent      = `${z.ttc} min`;

  // Sparkline
  drawSparkline("sparkline-svg", z.history || []);

  // Mini heatmap
  const mini = document.getElementById("mini-heatmap");
  drawMiniHeatmap(mini, zId, z.density, z.level);
}

function closeMapDetail() {
  selectedMapZone = null;
  document.getElementById("map-detail").classList.add("hidden");
}

function openHeatmapFromMap() {
  if (selectedMapZone) openHeatmap(selectedMapZone);
}

function sendAlertFromMap() {
  if (!selectedMapZone) return;
  const meta = ZONE_META[selectedMapZone];
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  addLog(`[${time}] ${currentUser.badge} sent alert for <span class="log-zone">${meta.name}</span>`);
  closeMapDetail();
  switchTab("alerts");
}

function drawSparkline(svgId, history) {
  const svg = document.getElementById(svgId);
  if (!history.length) return;
  svg.innerHTML = "";
  const W = 260, H = 50;
  const max = Math.max(...history, 1);
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = H - (v / max) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", pts);
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", "#00FF88");
  polyline.setAttribute("stroke-width", "2");
  polyline.setAttribute("stroke-linejoin", "round");
  svg.appendChild(polyline);
  // Fill area
  const area = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  area.setAttribute("points", `0,${H} ${pts} ${W},${H}`);
  area.setAttribute("fill", "rgba(0,255,136,0.1)");
  svg.appendChild(area);
}

// ── Forecast Tab ──────────────────────────────────────────────────────────
function renderForecastTab() {
  const container = document.getElementById("forecast-cards");
  container.innerHTML = "";

  for (const [zId, z] of Object.entries(SimState.zones)) {
    const f    = getForecast(zId);
    const meta = ZONE_META[zId];
    if (!f) continue;

    const trendIcon  = { up: "↑", same: "→", down: "↓" }[f.trend];
    const trendClass = { up: "trend-up", same: "trend-same", down: "trend-down" }[f.trend];
    const trendLabel = { up: "Rising", same: "Stable", down: "Falling" }[f.trend];

    const card = document.createElement("div");
    card.className = "forecast-card";

    // Forecast thumbnail canvas
    const thumbId = `fthumb-${zId}`;
    card.innerHTML = `
      <div class="forecast-left">
        <div class="forecast-zone">${meta.name}</div>
        <div class="forecast-pred">
          Predicted density: <span>${f.predictedDensity.toFixed(1)} p/m²</span>
        </div>
        <div class="trend-row">
          <span class="trend-arrow ${trendClass}">${trendIcon}</span>
          <span style="color:#7d8590">${trendLabel}</span>
        </div>
        <div class="ttc-badge ${f.level === "red" ? "red" : ""}">${f.ttc}<small style="font-size:12px"> min</small></div>
        <div class="conf-bar-bg" style="margin-top:4px">
          <div class="conf-bar-fill" style="width:${f.confidence}%"></div>
        </div>
        <div style="font-size:10px;color:#7d8590;margin-top:3px">Confidence ${Math.round(f.confidence)}%</div>
      </div>
      <div class="forecast-thumb-wrap">
        <canvas id="${thumbId}" width="80" height="60" class="forecast-thumb" onclick="openForecastHeatmap('${zId}')"></canvas>
        <span class="forecast-thumb-label">PREDICTED</span>
        <span class="risk-badge ${f.level}" style="margin-top:4px;font-size:10px">${f.level.toUpperCase()}</span>
      </div>
    `;
    container.appendChild(card);

    // Draw forecast thumbnail
    requestAnimationFrame(() => {
      const thumb = document.getElementById(thumbId);
      if (thumb) drawForecastThumb(thumb, zId, f.predictedDensity, f.level);
    });
  }
}

function updateAIBrief() {
  const el = document.getElementById("ai-brief-text");
  el.textContent = getAIBrief();
}

// Broadcast button
document.getElementById("btn-broadcast").addEventListener("click", () => {
  const msg = getAIBrief();
  document.getElementById("broadcast-msg").textContent = msg;
  document.getElementById("broadcast-overlay").classList.remove("hidden");
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  addLog(`[${time}] ${currentUser.badge} broadcast forecast alert to all guards`);
});

function closeBroadcast() {
  document.getElementById("broadcast-overlay").classList.add("hidden");
}

// ── Heatmap Modal ─────────────────────────────────────────────────────────
let _heatmapZone = null;
let _isForecastMode = false;

function openHeatmap(zId, isForecast = false, isAutoTrigger = false) {
  _heatmapZone    = zId;
  _isForecastMode = isForecast;
  _animState.markHotspot = false;

  const z    = SimState.zones[zId];
  const meta = ZONE_META[zId];
  if (!z) return;

  const modal  = document.getElementById("heatmap-modal");
  const banner = document.getElementById("modal-auto-banner");
  const wrap   = document.getElementById("canvas-wrap");
  const critEl = document.getElementById("critical-overlay");
  const fwEl   = document.getElementById("forecast-watermark");
  const modeEl = document.getElementById("modal-mode-label");

  // Set labels
  document.getElementById("modal-zone-title").textContent = meta.name;
  document.getElementById("modal-risk-badge").textContent = z.level.toUpperCase();
  document.getElementById("modal-risk-badge").className   = `risk-badge ${z.level}`;

  // Auto-trigger banner
  banner.classList.toggle("hidden", !isAutoTrigger);

  // Forecast watermark
  fwEl.classList.toggle("hidden", !isForecast);
  modeEl.textContent = isForecast
    ? `🔮 Predicted Heat — ~12 min`
    : `Live Crowd Heat Distribution`;

  // Critical overlay & pulse border
  critEl.classList.toggle("hidden", z.level !== "red");
  wrap.classList.toggle("critical-pulse", z.level === "red");

  // Show modal
  modal.classList.remove("hidden");

  // Start animation loop
  const canvas = document.getElementById("heatmap-canvas");
  startHeatmapAnimation(canvas, zId);

  updateModalStats(zId);
}

function openForecastHeatmap(zId) {
  openHeatmap(zId, true, false);
}

function closeHeatmap() {
  document.getElementById("heatmap-modal").classList.add("hidden");
  stopHeatmapAnimation();
  _heatmapZone = null;
  _animState.markHotspot = false;
}

function updateModalStats(zId) {
  const z = SimState.zones[zId];
  if (!z) return;
  document.getElementById("stat-peak").textContent = `${z.density.toFixed(1)} p/m²`;
  document.getElementById("stat-vel").textContent  = `${z.velocity.toFixed(2)} m/s`;
  document.getElementById("stat-cap").textContent  = `${Math.round((z.density / 10) * 100)}%`;
}

function markHotspot() {
  _animState.markHotspot = !_animState.markHotspot;
  const btn = document.getElementById("btn-mark-hotspot");
  btn.textContent = _animState.markHotspot ? "📍 Clear Mark" : "📍 Mark Hotspot";
}

function alertTeamFromModal() {
  if (_heatmapZone) {
    dispatchTeam(_heatmapZone);
  }
  closeHeatmap();
  switchTab("alerts");
}

// ── Swipe down to close modal ─────────────────────────────────────────────
let touchStartY = 0;
const sheet = document.getElementById("modal-sheet");
sheet.addEventListener("touchstart", e => { touchStartY = e.touches[0].clientY; });
sheet.addEventListener("touchend", e => {
  if (e.changedTouches[0].clientY - touchStartY > 80) closeHeatmap();
});
