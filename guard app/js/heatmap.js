/**
 * heatmap.js — Canvas Heatmap Renderer for CrowdAI Guard
 * ────────────────────────────────────────────────────────
 * Draws radial gradient heatmaps on HTML5 Canvas elements.
 * Used for: full modal heatmap, mini thumbnails, forecast thumbnails.
 */

// ── Hotspot definitions (relative coords 0–1) ─────────────────────────────
const HOTSPOTS = {
  Zone_A: [
    { x: 0.2, y: 0.3, weight: 1.0 },
    { x: 0.5, y: 0.5, weight: 0.9 },
    { x: 0.8, y: 0.3, weight: 0.8 },
    { x: 0.5, y: 0.8, weight: 0.7 },
  ],
  Zone_B: [
    { x: 0.3, y: 0.4, weight: 1.0 },
    { x: 0.6, y: 0.3, weight: 0.85 },
    { x: 0.5, y: 0.7, weight: 0.75 },
  ],
  Zone_C: [
    { x: 0.25, y: 0.5, weight: 1.0 },
    { x: 0.5,  y: 0.35, weight: 0.9 },
    { x: 0.75, y: 0.55, weight: 0.8 },
    { x: 0.5,  y: 0.75, weight: 0.7 },
  ],
};

// ── Color palette by risk level ───────────────────────────────────────────
function getColorStops(level) {
  if (level === "red") return [
    { pos: 0,    color: "rgba(255,255,255,0.9)" },
    { pos: 0.2,  color: "rgba(255,80,20,0.85)" },
    { pos: 0.5,  color: "rgba(255,30,0,0.6)" },
    { pos: 0.8,  color: "rgba(200,0,0,0.3)" },
    { pos: 1,    color: "rgba(100,0,0,0)" },
  ];
  if (level === "yellow") return [
    { pos: 0,    color: "rgba(255,240,100,0.85)" },
    { pos: 0.25, color: "rgba(255,160,0,0.75)" },
    { pos: 0.55, color: "rgba(220,100,0,0.45)" },
    { pos: 0.8,  color: "rgba(150,60,0,0.2)" },
    { pos: 1,    color: "rgba(0,0,0,0)" },
  ];
  return [
    { pos: 0,    color: "rgba(100,255,200,0.7)" },
    { pos: 0.3,  color: "rgba(0,200,180,0.5)" },
    { pos: 0.6,  color: "rgba(0,100,200,0.3)" },
    { pos: 0.85, color: "rgba(0,50,150,0.1)" },
    { pos: 1,    color: "rgba(0,0,0,0)" },
  ];
}

// ── Core draw function ────────────────────────────────────────────────────
/**
 * drawHeatmap(canvas, zoneId, density, level, opts)
 * 
 * @param {HTMLCanvasElement} canvas
 * @param {string} zoneId - "Zone_A" | "Zone_B" | "Zone_C"
 * @param {number} density - current crowd density (0–10)
 * @param {string} level   - "green" | "yellow" | "red"
 * @param {object} opts    - { breathe: bool, markHotspot: bool, breathePhase: number }
 */
function drawHeatmap(canvas, zoneId, density, level, opts = {}) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0d1117";
  ctx.roundRect(0, 0, W, H, 8);
  ctx.fill();

  // Stadium outline
  ctx.strokeStyle = "#2a3040";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(8, 8, W - 16, H - 16);

  // Subtle grid
  ctx.strokeStyle = "rgba(42,48,64,0.4)";
  ctx.lineWidth = 0.5;
  const cols = 6, rows = 4;
  for (let c = 1; c < cols; c++) {
    const x = 8 + (W - 16) * (c / cols);
    ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x, H - 8); ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    const y = 8 + (H - 16) * (r / rows);
    ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke();
  }

  const spots = HOTSPOTS[zoneId] || HOTSPOTS.Zone_A;
  const colorStops = getColorStops(level);
  const breatheScale = opts.breathe ? 1 + Math.sin(opts.breathePhase || 0) * 0.15 : 1;

  spots.forEach((spot, i) => {
    const cx = 8 + (W - 16) * spot.x;
    const cy = 8 + (H - 16) * spot.y;
    const baseR = 28 + density * 8;
    const r = baseR * spot.weight * breatheScale;
    const alpha = 0.15 + (density / 10) * 0.75;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    colorStops.forEach(({ pos, color }) => {
      // Scale alpha per hotspot
      const adjustedColor = color.replace(/[\d.]+\)$/, (a) => {
        const num = parseFloat(a);
        return (num * alpha * spot.weight).toFixed(2) + ")";
      });
      grad.addColorStop(pos, adjustedColor);
    });

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // Mark hotspot dot
  if (opts.markHotspot) {
    const peak = spots[0];
    const mx = 8 + (W - 16) * peak.x;
    const my = 8 + (H - 16) * peak.y;
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,59,48,0.9)";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ripple
    const rippleR = 6 + (Math.sin((opts.breathePhase || 0) * 2) + 1) * 6;
    ctx.beginPath();
    ctx.arc(mx, my, rippleR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,59,48,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// ── Animation loop for modal heatmap ─────────────────────────────────────
let _animFrame = null;
let _animState = {
  zoneId: null,
  level: "green",
  density: 1,
  breathePhase: 0,
  markHotspot: false,
};

function startHeatmapAnimation(canvas, zoneId) {
  _animState.zoneId = zoneId;
  stopHeatmapAnimation();

  function frame() {
    const z = SimState.zones[zoneId];
    if (!z) { _animFrame = requestAnimationFrame(frame); return; }

    _animState.breathePhase += 0.04;

    drawHeatmap(canvas, zoneId, z.density, z.level, {
      breathe: z.level === "red",
      markHotspot: _animState.markHotspot,
      breathePhase: _animState.breathePhase,
    });

    _animFrame = requestAnimationFrame(frame);
  }
  _animFrame = requestAnimationFrame(frame);
}

function stopHeatmapAnimation() {
  if (_animFrame) { cancelAnimationFrame(_animFrame); _animFrame = null; }
}

// ── Draw static mini thumbnail ────────────────────────────────────────────
function drawMiniHeatmap(canvas, zoneId, density, level) {
  drawHeatmap(canvas, zoneId, density, level, {
    breathe: false,
    markHotspot: false,
  });
}

// ── Draw forecast thumbnail (predicted values) ───────────────────────────
function drawForecastThumb(canvas, zoneId, predictedDensity, predictedLevel) {
  drawHeatmap(canvas, zoneId, predictedDensity, predictedLevel, {
    breathe: false,
    markHotspot: false,
  });
}

// ── Map zone colors ───────────────────────────────────────────────────────
const ZONE_MAP_COLORS = {
  green:  { fill: "rgba(0,255,136,0.2)",  stroke: "#00FF88" },
  yellow: { fill: "rgba(255,184,0,0.2)",  stroke: "#FFB800" },
  red:    { fill: "rgba(255,59,48,0.25)", stroke: "#FF3B30" },
};

function getZoneMapColor(level) {
  return ZONE_MAP_COLORS[level] || ZONE_MAP_COLORS.green;
}
