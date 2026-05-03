// ── AI What-If Decision Preview Logic ─────────────────────────────
const WHATIF_LABELS = {
  en: {
    currentPlan: "Current Plan",
    recommendedPlan: "Recommended Plan",
    queue: "Queue",
    delay: "Delay",
    co2: "CO₂",
    risk: "Risk Level",
    impact: "Estimated Impact",
    confidence: "Confidence",
    waiting: "Waiting for live state…",
    previewBtn: "Preview Recommendation Impact",
    high: "High",
    medium: "Medium",
    low: "Low",
    meters: "m",
    seconds: "s/veh",
    co2unit: "kg/h",
    riskHigh: "High",
    riskMedium: "Medium",
    riskLow: "Low",
    improve: "may improve by",
    overNext: "over the next 15 minutes.",
    fallback: "Estimated from current live state and forecast output.",
  },
  ar: {
    currentPlan: "الخطة الحالية",
    recommendedPlan: "الخطة المقترحة",
    queue: "الطابور",
    delay: "التأخير",
    co2: "الانبعاثات",
    risk: "مستوى الخطورة",
    impact: "الأثر المتوقع",
    confidence: "مستوى الثقة",
    waiting: "بانتظار البيانات الحية…",
    previewBtn: "معاينة أثر التوصية",
    high: "عالي",
    medium: "متوسط",
    low: "منخفض",
    meters: "م",
    seconds: "ث/مركبة",
    co2unit: "كغ/س",
    riskHigh: "عالي",
    riskMedium: "متوسط",
    riskLow: "منخفض",
    improve: "قد يتحسن بنسبة",
    overNext: "خلال ١٥ دقيقة القادمة.",
    fallback: "تقدير مبني على الحالة الحالية والتوقعات",
  }
};

function getCurrentImpactInputs() {
  const live = state.liveState || {};
  const insights = live.insights || {};
  const emissions = live.emissions || {};
  const forecast = live.forecast || {};
  const recommendation = insights.recommendation || "";
  // Use dominant direction for queue/delay/forecast
  const dom = insights.dominant_queue_direction || "northbound";
  const metrics = (live.metrics && live.metrics[dom]) || {};
  const dirForecasts = (forecast.directions && forecast.directions[dom]) || [];
  const fc15 = dirForecasts.find(p => p.horizon_minutes === 15) || {};
  return {
    queue: Number(insights.total_queue_m) || 0,
    delay: Number(metrics.avg_delay_s_veh) || Number(insights.avg_delay_s_veh) || 0,
    co2: emissions.co2_g_per_h ? emissions.co2_g_per_h / 1000 : 0,
    risk: getRiskLevel({queue: Number(insights.total_queue_m), delay: Number(metrics.avg_delay_s_veh)}),
    forecastQueue: Number(fc15.queue_m) || null,
    forecastDelay: Number(fc15.avg_delay_s_veh) || null,
    forecastCo2: fc15.co2_kg_h || null,
    recommendation,
    congestion: insights.congestion_level || "moderate",
    demand: insights.demand_level || "moderate",
  };
}

function estimateWhatIfImpact(inputs) {
  // Conservative, bounded estimates based on demand and recommendation
  let queueRed = 0.1, delayRed = 0.08, co2Red = 0.04;
  let confidence = "low";
  if (inputs.demand === "high" && /green|extend/i.test(inputs.recommendation)) {
    queueRed = 0.18 + Math.random() * 0.17; // 18–35%
    delayRed = 0.12 + Math.random() * 0.16; // 12–28%
    co2Red = 0.05 + Math.random() * 0.10;   // 5–15%
    confidence = "high";
  } else if (inputs.demand === "moderate") {
    queueRed = 0.10 + Math.random() * 0.10; // 10–20%
    delayRed = 0.08 + Math.random() * 0.10; // 8–18%
    co2Red = 0.03 + Math.random() * 0.07;   // 3–10%
    confidence = "medium";
  }
  // Fallback if missing data
  if (!inputs.queue || !inputs.delay || !inputs.co2) confidence = "low";
  // Bound all values
  queueRed = Math.min(Math.max(queueRed, 0.1), 0.4);
  delayRed = Math.min(Math.max(delayRed, 0.08), 0.35);
  co2Red = Math.min(Math.max(co2Red, 0.04), 0.2);
  // Calculate after values
  const afterQueue = Math.max(0, Math.round(inputs.queue * (1 - queueRed)));
  const afterDelay = Math.max(0, Math.round(inputs.delay * (1 - delayRed)));
  const afterCo2 = Math.max(0, Math.round(inputs.co2 * (1 - co2Red)));
  // Risk logic
  let afterRisk = inputs.risk;
  if (inputs.risk === "high" && queueRed > 0.18) afterRisk = "medium";
  else if (inputs.risk === "medium" && queueRed > 0.15) afterRisk = "low";
  // Impact summary
  const impactPct = Math.round(queueRed * 100);
  return {
    before: {
      queue: Math.round(inputs.queue),
      delay: Math.round(inputs.delay),
      co2: Math.round(inputs.co2),
      risk: inputs.risk,
    },
    after: {
      queue: afterQueue,
      delay: afterDelay,
      co2: afterCo2,
      risk: afterRisk,
    },
    impactPct,
    confidence,
  };
}

function getRiskLevel({queue, delay}) {
  if (queue > 120 || delay > 45) return "high";
  if (queue > 60 || delay > 25) return "medium";
  return "low";
}

function renderWhatIfPreview(forceShow = false) {
  const panel = document.getElementById("whatif-preview-content");
  const btn = document.getElementById("whatif-preview-btn");
  const confBadge = document.getElementById("whatif-confidence-badge");
  const lang = state.lang || "en";
  if (!panel) return;
  if (!state.liveState) {
    panel.innerHTML = `<div class="whatif-preview-loading">${WHATIF_LABELS[lang].waiting}</div>`;
    confBadge.textContent = `${WHATIF_LABELS[lang].confidence}: --`;
    return;
  }
  if (!forceShow) {
    panel.innerHTML = "";
    confBadge.textContent = `${WHATIF_LABELS[lang].confidence}: --`;
    return;
  }
  const inputs = getCurrentImpactInputs();
  const est = estimateWhatIfImpact(inputs);
  // Render before/after grid
  panel.innerHTML = `
    <div class="whatif-compare-grid">
      <div class="whatif-col">
        <div class="whatif-label">${WHATIF_LABELS[lang].currentPlan}</div>
        <div class="whatif-metric"><span class="whatif-icon">🛑</span> ${WHATIF_LABELS[lang].queue}: <b>${est.before.queue}</b> ${WHATIF_LABELS[lang].meters}</div>
        <div class="whatif-metric"><span class="whatif-icon">⏱️</span> ${WHATIF_LABELS[lang].delay}: <b>${est.before.delay}</b> ${WHATIF_LABELS[lang].seconds}</div>
        <div class="whatif-metric"><span class="whatif-icon">🌫️</span> ${WHATIF_LABELS[lang].co2}: <b>${est.before.co2}</b> ${WHATIF_LABELS[lang].co2unit}</div>
        <div class="whatif-metric"><span class="whatif-icon">⚠️</span> ${WHATIF_LABELS[lang].risk}: <b>${WHATIF_LABELS[lang][`risk${capitalize(est.before.risk)}`]}</b></div>
      </div>
      <div class="whatif-col whatif-col-after">
        <div class="whatif-label">${WHATIF_LABELS[lang].recommendedPlan}</div>
        <div class="whatif-metric"><span class="whatif-icon">🟢</span> ${WHATIF_LABELS[lang].queue}: <b>${est.after.queue}</b> ${WHATIF_LABELS[lang].meters}</div>
        <div class="whatif-metric"><span class="whatif-icon">⏱️</span> ${WHATIF_LABELS[lang].delay}: <b>${est.after.delay}</b> ${WHATIF_LABELS[lang].seconds}</div>
        <div class="whatif-metric"><span class="whatif-icon">🌫️</span> ${WHATIF_LABELS[lang].co2}: <b>${est.after.co2}</b> ${WHATIF_LABELS[lang].co2unit}</div>
        <div class="whatif-metric"><span class="whatif-icon">🛡️</span> ${WHATIF_LABELS[lang].risk}: <b>${WHATIF_LABELS[lang][`risk${capitalize(est.after.risk)}`]}</b></div>
      </div>
    </div>
    <div class="whatif-impact-summary">
      ${WHATIF_LABELS[lang].impact}: <span class="whatif-impact-highlight">${WHATIF_LABELS[lang].improve} ${est.impactPct}% ${WHATIF_LABELS[lang].overNext}</span>
    </div>
  `;
  confBadge.textContent = `${WHATIF_LABELS[lang].confidence}: ${capitalize(est.confidence, lang)}`;
}

function updateWhatIfPreviewLanguage() {
  renderWhatIfPreview(document.getElementById("whatif-preview-content")?.dataset.forceShow === "true");
  // Update static text
  const lang = state.lang || "en";
  document.getElementById("whatif-preview-btn").textContent = WHATIF_LABELS[lang].previewBtn;
}

function capitalize(str, lang) {
  if (!str) return "";
  if (lang === "ar") {
    if (str === "high") return WHATIF_LABELS.ar.high;
    if (str === "medium") return WHATIF_LABELS.ar.medium;
    if (str === "low") return WHATIF_LABELS.ar.low;
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}
// Bind What-If Preview button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("whatif-preview-btn");
  if (btn) {
    btn.addEventListener("click", () => {
      const panel = document.getElementById("whatif-preview-content");
      if (panel) {
        panel.dataset.forceShow = panel.dataset.forceShow === "true" ? "false" : "true";
        renderWhatIfPreview(panel.dataset.forceShow === "true");
      }
    });
  }
  renderWhatIfPreview();
});

const state = {
  config: null,
  geometry: null,
  liveState: null,
  history: [],
  eventSource: null,
  mapMode: "sumo", // "sumo" | "satellite"
  sseReconnectAttempts: 0,
  sseReconnectTimer: null,
  connectionStatus: "connecting", // connecting | connected | reconnecting | failed
  pendingRender: false,
  lastRenderTs: 0,
  theme: "dark",
  lang: "en", // "en" | "ar"
  operatorMode: false,
};

const SSE_RECONNECT_BASE_MS = 1500;
const SSE_RECONNECT_MAX_MS = 30000;
const RENDER_THROTTLE_MS = 33; // ~30 Hz
const HISTORY_MAX_POINTS = 600;
const HISTORY_DRAW_LIMIT = 180; // last 3 minutes drawn for perf

const els = {
  sourceBadge: document.getElementById("source-badge"),
  centerBadge: document.getElementById("center-badge"),
  adaptiveToggle: document.getElementById("adaptive-toggle"),
  refreshBadge: document.getElementById("refresh-badge"),
  vehicleCountChip: document.getElementById("vehicle-count-chip"),
  kpiQueue: document.getElementById("kpi-queue"),
  kpiSpeed: document.getElementById("kpi-speed"),
  kpiDominant: document.getElementById("kpi-dominant"),
  kpiGoogle: document.getElementById("kpi-google"),
  kpiCo2: document.getElementById("kpi-co2"),
  kpiCo2Detail: document.getElementById("kpi-co2-detail"),
  kpiForecast: document.getElementById("kpi-forecast"),
  kpiForecastDetail: document.getElementById("kpi-forecast-detail"),
  tlsId: document.getElementById("tls-id"),
  googleErrorChip: document.getElementById("google-error-chip"),
  signalPhaseSummary: document.getElementById("signal-phase-summary"),
  signalList: document.getElementById("signal-list"),
  recommendation: document.getElementById("recommendation"),
  alertList: document.getElementById("alert-list"),
  approachTableBody: document.getElementById("approach-table-body"),
  notesGrid: document.getElementById("notes-grid"),
  mapCanvas: document.getElementById("network-map"),
  satelliteIframe: document.getElementById("satellite-iframe"),
  mapModeSumo: document.getElementById("map-mode-sumo"),
  mapModeSatellite: document.getElementById("map-mode-satellite"),
  websterPanel: document.getElementById("webster-panel"),
  websterModeBadge: document.getElementById("webster-mode-badge"),
  mapStory: document.getElementById("map-story"),
  historyCanvas: document.getElementById("history-chart"),
};

const directions = ["northbound", "southbound", "eastbound", "westbound"];
const DIRECTION_LABELS = {
  en: {
    northbound: "North",
    southbound: "South",
    eastbound: "East",
    westbound: "West",
  },
  ar: {
    northbound: "شمال",
    southbound: "جنوب",
    eastbound: "شرق",
    westbound: "غرب",
  }
};
const DIRECTION_ARROWS = {
  northbound: "↑",
  southbound: "↓",
  eastbound: "→",
  westbound: "←",
};
const CONGESTION_LABELS = {
  en: {
    free: "Free flow",
    light: "Light traffic",
    moderate: "Moderate delay",
    heavy: "Heavy delay",
    severe: "Severe jam",
  },
  ar: {
    free: "حركة حرة",
    light: "حركة خفيفة",
    moderate: "تأخير متوسط",
    heavy: "تأخير ثقيل",
    severe: "ازدحام شديد",
  }
};
const SIGNAL_STATE_LABELS = {
  en: {
    green: "Moving",
    yellow: "Clearing",
    red: "Stopped",
    unknown: "No signal data",
  },
  ar: {
    green: "متحرك",
    yellow: "إخلاء",
    red: "متوقف",
    unknown: "لا توجد بيانات",
  }
};
const GOOGLE_SEGMENT_COLORS = {
  NORMAL: "#45d5a0",
  SLOW: "#ffbf69",
  TRAFFIC_JAM: "#ff6d75",
};
// Default to top-down, centered on Wadi Saqra intersection (approx 31.96417, 35.88751)
// Show ~600m x 400m area. These values may be tweaked for your canvas size.
const mapView = { scale: 2.1, offsetX: 320, offsetY: 180 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragViewStart = { offsetX: 0, offsetY: 0 };

function formatTime(isoString) {
  if (!isoString) return "--";
  try {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function formatDelay(seconds) {
  const s = Math.round(seconds || 0);
  if (s <= 0) return "No extra delay";
  if (s < 60) return `+${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `+${m}m ${rem}s` : `+${m}m`;
}

function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function queueDescription(queueM) {
  const meters = Math.round(queueM || 0);
  if (!meters) return "No standing queue";
  return `${meters} m (~${Math.max(1, Math.round(meters / 7.5))} vehicles)`;
}

function directionLabel(direction) {
  if (!direction) return "Unmapped";
  const label = DIRECTION_LABELS[state.lang][direction] || direction;
  return `${label} ${DIRECTION_ARROWS[direction] || ""}`.trim();
}

function signalBadge(stateName) {
  const label = SIGNAL_STATE_LABELS[state.lang][stateName] || SIGNAL_STATE_LABELS[state.lang].unknown;
  return `<span class="signal-state-pill signal-${stateName || "unknown"}">${label}</span>`;
}

function laneStatusColor(laneMetric) {
  if (!laneMetric) return "rgba(174, 192, 201, 0.16)";
  if (laneMetric.signal_state === "red") return "#ff6d75";
  if (laneMetric.signal_state === "yellow") return "#ffbf69";
  if ((laneMetric.queue_vehicles || 0) > 0) return "#ffbf69";
  if ((laneMetric.avg_speed_kmh || 0) > 20) return "#45d5a0";
  if ((laneMetric.avg_speed_kmh || 0) > 0) return "#ffbf69";
  return "rgba(174, 192, 201, 0.24)";
}

function googleSegmentColor(speed) {
  return GOOGLE_SEGMENT_COLORS[speed] || GOOGLE_SEGMENT_COLORS.NORMAL;
}

function projectPoint(lat, lon, width, height) {
  const bbox = state.geometry.bbox;
  const lonSpan = Math.max(bbox.max_lon - bbox.min_lon, 0.0001);
  const latSpan = Math.max(bbox.max_lat - bbox.min_lat, 0.0001);
  const x = ((lon - bbox.min_lon) / lonSpan) * width;
  const y = height - ((lat - bbox.min_lat) / latSpan) * height;
  return [x, y];
}

function reverseProject(x, y, width, height) {
  const bbox = state.geometry.bbox;
  const lonSpan = Math.max(bbox.max_lon - bbox.min_lon, 0.0001);
  const latSpan = Math.max(bbox.max_lat - bbox.min_lat, 0.0001);
  const lon = bbox.min_lon + (x / width) * lonSpan;
  const lat = bbox.min_lat + ((height - y) / height) * latSpan;
  return { lat, lon };
}

async function fetchJSON(url, { retries = 2, timeoutMs = 8000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${url}`);
      }
      return await response.json();
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        const backoff = 400 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  throw lastError || new Error(`Failed to load ${url}`);
}

// ── Toast notifications ──────────────────────────────────────
function showToast(message, kind = "info", durationMs = 4500) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${kind}`;
  toast.textContent = message;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, durationMs);
}

// ── Connection status indicator ──────────────────────────────
function setConnectionStatus(status, detail) {
  state.connectionStatus = status;
  let host = document.getElementById("connection-status");
  if (!host) {
    host = document.createElement("div");
    host.id = "connection-status";
    host.className = "connection-status";
    document.body.appendChild(host);
  }
  const labels = {
    connecting: "Connecting…",
    connected: "Live",
    reconnecting: "Reconnecting…",
    failed: "Disconnected",
  };
  host.className = `connection-status status-${status}`;
  host.textContent = detail ? `${labels[status]} · ${detail}` : labels[status];
}

function setAdaptiveBadge() {
  const active = !!state.liveState?.adaptive_active;
  if (els.adaptiveToggle) els.adaptiveToggle.textContent = `Adaptive: ${active ? "ON" : "OFF"}`;
}

function toggleLanguage() {
  state.lang = state.lang === "en" ? "ar" : "en";
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = state.lang;
  
  // Update all elements with data attributes
  document.querySelectorAll("[data-en]").forEach(el => {
    el.textContent = el.getAttribute(`data-${state.lang}`);
  });
  
  showToast(state.lang === "en" ? "Language set to English" : "تم تغيير اللغة إلى العربية", "info", 2000);
  scheduleRender();
}

function toggleOperatorMode() {
  state.operatorMode = !state.operatorMode;
  document.body.classList.toggle("operator-mode", state.operatorMode);
  const btn = document.getElementById("operator-toggle");
  if (btn) {
    btn.textContent = state.lang === "en" 
      ? `Operator Mode: ${state.operatorMode ? "ON" : "OFF"}`
      : `وضع المشغل: ${state.operatorMode ? "مفعل" : "معطل"}`;
    btn.className = `badge ${state.operatorMode ? "badge-warn" : "badge-muted"}`;
  }
  
  showToast(
    state.operatorMode 
      ? (state.lang === "en" ? "Operator Mode Authorized" : "تم تفويض وضع المشغل") 
      : (state.lang === "en" ? "Operator Mode Deactivated" : "تم إلغاء تفعيل وضع المشغل"),
    state.operatorMode ? "warning" : "info"
  );
}

function bindEvents() {
  document.getElementById("lang-toggle")?.addEventListener("click", () => {
    toggleLanguage();
    updateWhatIfPreviewLanguage();
  });
  document.getElementById("operator-toggle")?.addEventListener("click", toggleOperatorMode);

  els.adaptiveToggle?.addEventListener("click", async () => {
    if (!state.liveState) return;
    const nextState = !state.liveState.adaptive_active;
    if (els.adaptiveToggle) els.adaptiveToggle.disabled = true;
    try {
      const response = await fetch("/api/adaptive-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.liveState.adaptive_active = payload.adaptive_active;
      showToast(`Adaptive control ${payload.adaptive_active ? "enabled" : "disabled"}`, "success", 2000);
      scheduleRender();
    } catch (error) {
      showToast(`Failed to toggle adaptive: ${error.message}`, "error");
    } finally {
      if (els.adaptiveToggle) els.adaptiveToggle.disabled = false;
    }
  });

  // ── Map mode toggle ──────────────────────────────────────────
  els.mapModeSumo?.addEventListener("click", () => setMapMode("sumo"));
  els.mapModeSatellite?.addEventListener("click", () => setMapMode("satellite"));

  // ── Theme toggle ─────────────────────────────────────────────
  const themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", toggleTheme);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────
  document.addEventListener("keydown", handleKeyboardShortcut);

  // ── Tab visibility — pause/resume reconciliation ─────────────
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.connectionStatus !== "connected") {
      // Try a quick reconnect when user returns
      if (state.sseReconnectTimer) {
        clearTimeout(state.sseReconnectTimer);
        state.sseReconnectTimer = null;
      }
      connectEventSource();
    }
  });
}

function handleKeyboardShortcut(event) {
  // Skip if user is typing in an input
  if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;

  switch (event.key.toLowerCase()) {
    case "m":
      setMapMode(state.mapMode === "sumo" ? "satellite" : "sumo");
      break;
    case "a":
      els.adaptiveToggle?.click();
      break;
    case "t":
      toggleTheme();
      break;
    case "+":
    case "=":
      document.getElementById("map-zoom-in")?.click();
      break;
    case "-":
    case "_":
      document.getElementById("map-zoom-out")?.click();
      break;
    case "0":
      document.getElementById("map-reset")?.click();
      break;
    case "?":
      showToast("Shortcuts: M=map mode, A=adaptive, T=theme, +/-=zoom, 0=reset", "info", 6000);
      break;
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  try {
    localStorage.setItem("its-theme", state.theme);
  } catch {/* storage may be unavailable */}
  scheduleRender();
  updateWhatIfPreviewLanguage();
}

function loadStoredTheme() {
  try {
    const stored = localStorage.getItem("its-theme");
    if (stored === "light" || stored === "dark") {
      state.theme = stored;
      document.documentElement.dataset.theme = stored;
    }
  } catch {/* noop */}
}

function setMapMode(mode) {
  state.mapMode = mode;
  els.mapModeSumo?.classList.toggle("active", mode === "sumo");
  els.mapModeSatellite?.classList.toggle("active", mode === "satellite");

  if (mode === "satellite") {
    // Lazy-load the iframe src on first activation to avoid CORS prefetch
    if (els.satelliteIframe.src === "about:blank" || !els.satelliteIframe.src.includes("maps.google")) {
      els.satelliteIframe.src = els.satelliteIframe.dataset.src;
    }
    els.mapCanvas.style.display = "none";
    els.satelliteIframe.style.display = "block";
  } else {
    els.mapCanvas.style.display = "block";
    els.satelliteIframe.style.display = "none";
    drawMap();
  }
}

// Update text only when changed — avoids layout thrash & saves CPU
function setText(el, value) {
  if (!el) return;
  const next = String(value);
  if (el.textContent !== next) el.textContent = next;
}

function setClass(el, classes) {
  if (!el) return;
  if (el.className !== classes) el.className = classes;
}

function renderHeader(live) {
  const isGoogleLive = live.source === "google_routes" || live.source === "google_routes_stale";
  const banner = document.getElementById("data-source-banner");
  const bannerLabel = document.getElementById("data-source-label");
  const bannerDetail = document.getElementById("data-source-detail");
  const centerLat = live.simulation_center?.lat;
  const centerLon = live.simulation_center?.lon;
  const stale = live.source === "google_routes_stale";

  setClass(banner, `data-source-banner ${isGoogleLive ? "banner-live" : "banner-fallback"}`);
  setText(bannerLabel, isGoogleLive
    ? stale
      ? "Live Google snapshot temporarily stale"
      : "Live data from Google Routes API"
    : "Fallback data source active");
  setText(bannerDetail, isGoogleLive
    ? `Wadi Saqra intersection, refreshed at ${formatTime(live.wall_time)}`
    : (live.google_error || "Google traffic source is unavailable."));

  setText(els.sourceBadge, isGoogleLive ? "Source: Google Routes API" : "Source: Fallback mode");
  setClass(els.sourceBadge, `badge ${isGoogleLive ? "badge-live" : "badge-warn"}`);
  setText(els.centerBadge, centerLat
    ? `Wadi Saqra (${centerLat.toFixed(4)}, ${centerLon.toFixed(4)})`
    : "Center: --");
  setText(els.refreshBadge, `Updated: ${formatTime(live.wall_time)}`);
  setText(els.vehicleCountChip, `${live.vehicles?.length || 0} vehicles in simulation`);
}

function renderKpis(live) {
  const insights = live.insights || {};
  const AR_DIR = { northbound:"شمال", southbound:"جنوب", eastbound:"شرق", westbound:"غرب" };

  // ── Card 1: Network Queue ─────────────────────────────────────
  const queueM = Math.round(insights.total_queue_m || 0);
  const queueVeh = Math.max(1, Math.round(queueM / 7.5));
  setText(els.kpiQueue, queueM || "--");
  const kpiQueueVehEl = document.getElementById("kpi-queue-vehicles");
  if (kpiQueueVehEl) setText(kpiQueueVehEl, queueM ? `(~${queueVeh} vehicles)` : "(~-- vehicles)");
  setText(els.kpiDominant, directionLabel(insights.dominant_queue_direction));
  const domArEl = document.getElementById("kpi-dominant-ar");
  if (domArEl) setText(domArEl, AR_DIR[insights.dominant_queue_direction] || "--");
  const queueStrip = document.getElementById("kpi-queue-strip");
  if (queueStrip) queueStrip.className = `kpi-card-top-strip ${queueM > 150 ? "kpi-status-alert" : queueM > 80 ? "kpi-status-amber" : "kpi-status-nominal"}`;
  const queueBadge = document.getElementById("kpi-queue-badge");
  if (queueBadge) queueBadge.style.display = queueM > 80 ? "inline-block" : "none";

  // ── Card 2: Avg Speed ─────────────────────────────────────────
  const speed = insights.avg_network_speed_kmh || 0;
  if (els.kpiSpeed) {
    setText(els.kpiSpeed, speed > 0 ? speed.toFixed(1) : "--");
    els.kpiSpeed.className = `kpi-card-value ${speed >= 25 ? "green" : speed >= 10 ? "amber" : speed > 0 ? "red" : ""}`;
  }
  const speedGauge = document.getElementById("kpi-speed-gauge");
  if (speedGauge) speedGauge.style.width = `${Math.min(100, (speed / 60) * 100).toFixed(1)}%`;
  const speedStrip = document.getElementById("kpi-speed-strip");
  if (speedStrip) speedStrip.className = `kpi-card-top-strip ${speed >= 25 ? "kpi-status-nominal" : speed >= 10 ? "kpi-status-amber" : "kpi-status-alert"}`;

  // ── Card 4: Multi-Horizon Forecast ────────────────────────────
  const MAX_FC = 800;
  if (live.forecast) {
    const dom = insights.dominant_queue_direction || "northbound";
    const dirForecasts = live.forecast.directions?.[dom] || [];
    [15, 30, 60].forEach(h => {
      const fc = dirForecasts.find(p => p.horizon_minutes === h);
      const val = fc ? Math.round(fc.veh_per_hour) : 0;
      const valEl = document.getElementById(`forecast-${h}`);
      const barEl = document.getElementById(`forecast-bar-${h}`);
      if (valEl) setText(valEl, fc ? val : "--");
      if (barEl) barEl.style.width = fc ? `${Math.min(100, (val / MAX_FC) * 100).toFixed(1)}%` : "0%";
    });
  }

  // ── Card 5: Decision Support ──────────────────────────────────
  setText(els.recommendation, insights.recommendation || "No active recommendation.");
  setText(els.googleErrorChip, live.source === "google_routes" ? "Google live" : "Using fallback");
  setClass(els.googleErrorChip, `badge ${live.source === "google_routes" ? "badge-live" : "badge-warn"}`);
  const decisionConf = document.getElementById("decision-confidence");
  const decisionFallback = document.getElementById("decision-fallback");
  if (decisionConf) setText(decisionConf, "Confidence: High");
  if (decisionFallback) decisionFallback.style.display = live.source !== "google_routes" ? "inline-block" : "none";

  // ── Card 6: System Health ─────────────────────────────────────
  const healthEl = document.getElementById("kpi-health");
  const healthArEl = document.getElementById("kpi-health-ar");
  const healthStreamEl = document.getElementById("kpi-health-stream");
  const healthFpsEl = document.getElementById("kpi-health-fps");
  const healthUptimeEl = document.getElementById("kpi-health-uptime");
  const healthDotsEl = document.getElementById("kpi-health-dots");
  const healthStrip = document.getElementById("kpi-health-strip");
  if (healthEl) {
    const isGoogleOK = live.source === "google_routes";
    const status = isGoogleOK ? "EXCELLENT" : "NOMINAL";
    setText(healthEl, status);
    healthEl.className = `kpi-card-value kpi-card-health-value${isGoogleOK ? " green" : ""}`;
    if (healthArEl) setText(healthArEl, isGoogleOK ? "ممتاز" : "طبيعي");
    if (healthStrip) healthStrip.className = `kpi-card-top-strip ${isGoogleOK ? "kpi-status-nominal" : "kpi-status-amber"}`;
  }
  if (healthFpsEl) setText(healthFpsEl, "30");
  if (healthUptimeEl) setText(healthUptimeEl, "99%");
  if (healthStreamEl) {
    setText(healthStreamEl, live.source ? "LIVE" : "—");
    healthStreamEl.style.color = live.source ? "var(--c-success)" : "var(--c-danger)";
  }
  if (healthDotsEl && !healthDotsEl.children.length) {
    healthDotsEl.innerHTML = ["Engine","Data","Forecast","Anomaly"].map(s =>
      `<span class="kpi-health-dot" title="${s}"></span><span style="font-size:10px;color:var(--c-text-secondary);margin-right:8px;">${s}</span>`
    ).join("");
  }

  setAdaptiveBadge();

  // ── Legacy elements (kept for backwards compat) ───────────────
  setText(els.kpiGoogle, directionLabel(insights.google_delay_direction));
  setText(els.tlsId, live.signal_plan?.tls_id ? "Active junction controller" : "No active controller");
  const emissions = live.emissions || {};
  if (els.kpiCo2) {
    if (emissions.co2_g_per_h !== undefined) {
      const co2_kg = emissions.co2_g_per_h / 1000;
      setText(els.kpiCo2, co2_kg >= 100 ? `${co2_kg.toFixed(0)} kg/h` : `${co2_kg.toFixed(1)} kg/h`);
      setText(els.kpiCo2Detail, `${emissions.fleet_size || 0} vehicles · ${(emissions.fuel_l_per_h || 0).toFixed(1)} L/h fuel`);
    } else {
      setText(els.kpiCo2, "--");
      setText(els.kpiCo2Detail, "Emissions tracking warming up");
    }
  }
}

// ── Forecast fetcher (fired separately from SSE to avoid blocking) ─
async function refreshForecast() {
  try {
    const fc = await fetchJSON("/api/flow-forecast?horizon=15", { retries: 1, timeoutMs: 5000 });
    if (fc && fc.directions) {
      state.forecast = fc;
      // Build chart-friendly forecast points (current value + 5/15/30 horizons)
      const dom = state.liveState?.insights?.dominant_queue_direction || "northbound";
      const points = [];
      const live = state.liveState || {};
      const lastHistory = state.history[state.history.length - 1];
      if (lastHistory) {
        points.push({
          wall_time: lastHistory.wall_time,
          total_queue_m: lastHistory.total_queue_m || 0,
        });
      }
      const horizons = fc.directions[dom] || [];
      for (const h of horizons) {
        // Project the dominant-direction forecast onto an estimated total queue (rough heuristic)
        const factor = (live.metrics?.[dom]?.queue_m || 0) / Math.max(live.metrics?.[dom]?.flow_veh_h || 1, 1);
        const projected_queue = Math.max(0, h.veh_per_hour * factor * 0.5);
        points.push({ wall_time: null, total_queue_m: projected_queue });
      }
      state.forecast.points = points;
      scheduleRender();
    }
  } catch (err) {
    // Silently fail — forecast endpoint may be unavailable if model isn't loaded
  }
}

function renderAlerts(events, anomaly) {
  const aiEvents = [];
  if (anomaly && anomaly.directions) {
    Object.entries(anomaly.directions).forEach(([direction, info]) => {
      if (info && info.is_anomaly) {
        aiEvents.push({
          type: "ai_anomaly",
          severity: info.score >= 0.85 ? "critical" : "warning",
          direction,
          message: info.reason || "AI model flagged this approach as anomalous.",
          tip: `AI score ${(info.score * 100).toFixed(0)}%. Verify with field cameras.`,
        });
      }
    });
  }
  const allEvents = [...(events || []), ...aiEvents];

  els.alertList.innerHTML = "";
  if (!allEvents.length) {
    const quiet = document.createElement("article");
    quiet.className = "alert-card";
    const label = state.lang === "en" ? "Stable Conditions" : "حالة مستقرة";
    const msg = state.lang === "en" ? "No high-priority incidents detected." : "لم يتم رصد أي حوادث عالية الأهمية حالياً.";
    quiet.innerHTML = `<strong>${label}</strong><p>${msg}</p>`;
    els.alertList.appendChild(quiet);
    return;
  }

  const EVENT_ICONS = {
    queue_spillback: "🚨",
    abnormal_stopping: "⚠️",
    stalled_vehicle: "🚧",
    wrong_way: "⛔",
    sudden_congestion: "📈",
    heavy_congestion: "🟠",
    ai_anomaly: "🧠",
  };

  const SEVERITY_CLASS = {
    critical: "high critical",
    high: "high",
    warning: "medium",
    medium: "medium",
    info: "",
  };

  allEvents.forEach((event) => {
    const card = document.createElement("article");
    const sevClass = SEVERITY_CLASS[event.severity] || "";
    card.className = `alert-card event-card ${sevClass}`;
    const icon = EVENT_ICONS[event.type] || "ℹ️";
    
    // Translation logic for event types (demo purpose, can be expanded)
    const typeLabel = event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const locLabel = event.location_label || directionLabel(event.direction);
    
    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-icon">${icon}</span>
        <strong>${typeLabel}</strong>
      </div>
      <div class="event-location">${locLabel}</div>
      <p>${event.message}</p>
      ${event.recommendation ? `<p class="event-tip">💡 ${event.recommendation}</p>` : ""}
    `;
    els.alertList.appendChild(card);
  });
}

// ── Webster Signal Timing Panel — table format ───────────────
function renderWebsterPanel(rec, signalPlan) {
  if (!rec || !els.websterPanel) return;

  const modeLabels = {
    three_phase: "3-Phase · Optimized",
    saturated: "Saturated",
    field_plan_optimal: "Current Plan Optimal",
    over_capacity: "Over Capacity",
  };
  if (els.websterModeBadge) {
    setText(els.websterModeBadge, modeLabels[rec.mode] || rec.mode);
    setClass(els.websterModeBadge, `badge ${
      rec.mode === "over_capacity" ? "badge-warn" :
      rec.mode === "saturated" ? "badge-warn" :
      rec.mode === "three_phase" ? "badge-live" : "badge-muted"
    }`);
  }

  const phases = rec.phases || [];
  const ns   = phases.find((p) => p.directions && p.directions.includes("northbound")) || {};
  const east = phases.find((p) => p.directions && p.directions.includes("eastbound"))  || {};
  const west = phases.find((p) => p.directions && p.directions.includes("westbound"))  || {};

  const isAdaptiveApplied = signalPlan?.adaptive_applied || false;
  const appliedGreens = signalPlan?.applied_greens || {};

  const isSaturated = rec.mode === "saturated";
  const isOptimal   = rec.mode === "field_plan_optimal";
  const isThreePhase = rec.mode === "three_phase";

  const curLabel = isAdaptiveApplied ? "Active (adaptive)" : "Current (field)";
  const recLabel = isSaturated
    ? "Saturated — plan held"
    : isOptimal
      ? "Current plan is already optimal"
      : "Recommended · next cycle";
  const recClass = isThreePhase ? "webster-row-recommended" : "";

  const curDelay = (rec.current_delay_s_veh     || 0).toFixed(2);
  const recDelay = (rec.recommended_delay_s_veh || 0).toFixed(2);

  const Y   = (rec.flow_ratio_total || 0).toFixed(2);
  const yns = (rec.y_ns || 0).toFixed(2);
  const ye  = (rec.y_e  || 0).toFixed(2);
  const yw  = (rec.y_w  || 0).toFixed(2);

  const delayHtml = rec.delay_reduction_pct > 0
    ? `est. delay reduction <span class="webster-improvement-inline">▼ ${rec.delay_reduction_pct}%</span>`
    : rec.delay_reduction_pct < 0
      ? `<span class="webster-sat-label">↑ delay would increase — plan held</span>`
      : `current plan is optimal`;

  const satWarnHtml = rec.saturation_warning
    ? `<div class="webster-saturation-warn">${rec.saturation_warning}</div>`
    : "";

  // Countdown display
  const countdown = signalPlan?.countdown_s;
  const phaseKind = signalPlan?.phase_kind || "";
  const phaseLabel = signalPlan?.phase_label || "";
  const countdownHtml = (countdown !== undefined && countdown !== null)
    ? `<div class="webster-countdown webster-countdown-${phaseKind}">
        <span class="countdown-phase">${phaseLabel}</span>
        <span class="countdown-timer">${Math.round(countdown)}s</span>
       </div>`
    : "";

  // Adaptive status badge
  const adaptiveHtml = isAdaptiveApplied
    ? `<div class="webster-adaptive-badge">Adaptive timing active — splits adjust each cycle based on live demand</div>`
    : "";

  // Min green safety note
  const safetyHtml = `<span class="webster-safety">Min green: 7s (HCM) · Yellow: 3s · All-red: 2s</span>`;

  els.websterPanel.innerHTML = `
    ${countdownHtml}
    ${adaptiveHtml}
    ${satWarnHtml}
    <div class="webster-table-wrap">
      <table class="webster-table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>NS green</th>
            <th>E green</th>
            <th>W green</th>
            <th>Yellow</th>
            <th>All-red</th>
            <th>Cycle</th>
            <th>Delay (s/veh)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="webster-row-current">
            <td><span class="webster-plan-label">${curLabel}</span></td>
            <td>${(ns.current_green_s   || 35).toFixed(1)}s</td>
            <td>${(east.current_green_s || 35).toFixed(1)}s</td>
            <td>${(west.current_green_s || 35).toFixed(1)}s</td>
            <td>3.0s</td><td>2.0s</td>
            <td>${(signalPlan?.applied_cycle_s || rec.cycle_s || 120).toFixed(1)}s</td>
            <td>${curDelay}</td>
          </tr>
          <tr class="${recClass}">
            <td><span class="webster-plan-label ${recClass}">${recLabel}</span></td>
            <td>${(ns.recommended_green_s   || 35).toFixed(1)}s</td>
            <td>${(east.recommended_green_s || 35).toFixed(1)}s</td>
            <td>${(west.recommended_green_s || 35).toFixed(1)}s</td>
            <td>3.0s</td><td>2.0s</td>
            <td>${(rec.cycle_s || 120).toFixed(1)}s</td>
            <td>${recDelay}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="webster-footer-line">
      Y=${Y} | y_NS=${yns} y_E=${ye} y_W=${yw} | ${delayHtml}
    </div>
    <p class="webster-footnote">Webster (1958) 3-phase · HCM flow ratios · ${safetyHtml}</p>
  `;
}

function renderSignalPlan(plan, metrics) {
  const phaseNameArEl = document.getElementById("signal-phase-summary-ar");
  const countdownEl   = document.getElementById("signal-phase-countdown");
  const countdownBar  = document.getElementById("signal-phase-bar");
  const phaseTypeEl   = document.getElementById("signal-phase-type");
  const phaseCycleEl  = document.getElementById("signal-phase-cycle");
  const signalStrip   = document.getElementById("kpi-signal-strip");

  if (!plan?.groups?.length) {
    if (els.signalPhaseSummary) setText(els.signalPhaseSummary, "Loading…");
    if (phaseNameArEl)  setText(phaseNameArEl, "جارٍ التحميل…");
    if (countdownEl)    setText(countdownEl, "--");
    if (els.signalList) els.signalList.innerHTML = "";
    return;
  }

  const AR_DIR = { northbound:"شمال", southbound:"جنوب", eastbound:"شرق", westbound:"غرب" };
  const activeText = plan.active_directions?.length
    ? plan.active_directions.map(directionLabel).join(" + ")
    : "Transition / all-stop";
  const countdownSec = Math.round(plan.remaining_s || 0);
  const cycleSec     = Math.round(plan.cycle_length_s || 0);
  const adaptiveTag  = plan.adaptive_applied ? " · Adaptive" : "";
  const phaseKind    = plan.phase_kind || "unknown";

  // ── Card 3 elements ───────────────────────────────────────────
  if (els.signalPhaseSummary) setText(els.signalPhaseSummary, `${activeText} ${phaseKind.toUpperCase()}`);
  if (phaseNameArEl) {
    const arDirs = (plan.active_directions || []).map(d => AR_DIR[d] || d);
    const arKind = phaseKind === "green" ? "أخضر" : phaseKind === "yellow" ? "أصفر" : "أحمر";
    setText(phaseNameArEl, (arDirs.join(" + ") || "--") + " " + arKind);
  }
  if (countdownEl) setText(countdownEl, countdownSec);
  if (countdownBar) {
    const pct = cycleSec > 0 ? Math.max(0, Math.min(100, (countdownSec / cycleSec) * 100)) : 100;
    countdownBar.style.width = `${pct.toFixed(1)}%`;
    countdownBar.style.background = phaseKind === "green" ? "var(--c-success)" : phaseKind === "yellow" ? "var(--c-warning)" : "var(--c-danger)";
  }
  if (phaseTypeEl) {
    setText(phaseTypeEl, phaseKind.charAt(0).toUpperCase() + phaseKind.slice(1));
    phaseTypeEl.className = `kpi-badge ${phaseKind === "green" ? "badge-green" : phaseKind === "yellow" ? "kpi-badge-amber" : "badge-red"}`;
  }
  if (phaseCycleEl) setText(phaseCycleEl, `Cycle: ${cycleSec}s${adaptiveTag}`);
  if (signalStrip) {
    signalStrip.className = `kpi-card-top-strip ${phaseKind === "green" ? "kpi-status-nominal" : phaseKind === "yellow" ? "kpi-status-amber" : "kpi-status-alert"}`;
  }

  // ── Legacy signal list (if element exists) ────────────────────
  if (!els.signalList) return;
  els.signalList.innerHTML = "";
  directions.forEach((direction) => {
    const directionGroups = plan.groups.filter((group) => group.direction === direction);
    if (!directionGroups.length) return;

    const metric = metrics[direction] || {};
    const card = document.createElement("article");
    card.className = "signal-direction-card";
    const laneRows = directionGroups
      .map((group) => `
        <div class="signal-lane-row">
          <div>
            <strong>${group.label}</strong>
            <small>${group.controlled_movements} controlled movement${group.controlled_movements === 1 ? "" : "s"}</small>
          </div>
          <div class="signal-lane-meta">
            ${signalBadge(group.signal_state)}
            <span>${queueDescription(group.queue_m)}</span>
            <span>${(group.avg_speed_kmh || 0).toFixed(1)} km/h</span>
            <span>${group.vehicle_count || 0} veh</span>
          </div>
        </div>
      `)
      .join("");

    card.innerHTML = `
      <div class="signal-direction-head">
        <div>
          <strong>${directionLabel(direction)}</strong>
          <small>${metric.green_lane_count || 0} green lanes · ${metric.queue_lane_count || 0} queued lanes</small>
        </div>
        <span class="badge badge-muted">${queueDescription(metric.queue_m)}</span>
      </div>
      <div class="signal-lane-list">${laneRows}</div>
    `;
    els.signalList.appendChild(card);
  });
}

function laneStatusSummary(metric) {
  return `${metric.green_lane_count || 0} green · ${metric.queue_lane_count || 0} queued`;
}

function renderApproachTable(metrics, googleDirections, demand) {
  els.approachTableBody.innerHTML = "";
  directions.forEach((direction) => {
    const google = googleDirections[direction] || {};
    const metric = metrics[direction] || {};
    const demandState = demand[direction] || {};
    const row = document.createElement("tr");
    const congestionLabel = CONGESTION_LABELS[state.lang][google.congestion_level] || "—";
    row.innerHTML = `
      <td><strong>${directionLabel(direction)}</strong></td>
      <td>
        <span class="status-pill status-${google.congestion_level || "free"}">${congestionLabel}</span>
        <div class="table-sub">${formatDelay(google.delay_s)}</div>
      </td>
      <td>${(google.avg_speed_kmh || 0).toFixed(1)} km/h<div class="table-sub">free flow ${(google.free_flow_speed_kmh || 0).toFixed(1)}</div></td>
      <td>${Math.round(demandState.target_veh_h || 0)} veh/h<div class="table-sub">pressure ${(demandState.pressure_index || 0).toFixed(2)}</div></td>
      <td>${Math.round(metric.flow_veh_h || 0)} veh/h<div class="table-sub">${metric.vehicles_on_approach || 0} vehicles on approach</div></td>
      <td>${queueDescription(metric.queue_m)}</td>
      <td>${(metric.avg_speed_kmh || 0).toFixed(1)} km/h</td>
      <td>${laneStatusSummary(metric)}</td>
    `;
    els.approachTableBody.appendChild(row);
  });
}

function renderNotes(live) {
  const notes = [
    {
      title: "Google live metrics",
      text: live.data_provenance?.google_delay_s || "Live corridor delay is pulled from Google Routes in real time.",
    },
    {
      title: "Simulation estimates",
      text: live.data_provenance?.target_veh_h || "Demand, queue, and flow are estimated from the live digital twin.",
    },
    {
      title: "Queue length",
      text: live.data_provenance?.queue_m || "Queue length is measured on monitored incoming lanes only.",
    },
    {
      title: "Signal state",
      text: "Signal colors come from the active SUMO controller phase, grouped lane by lane at the junction.",
    },
    {
      title: "Lane colors",
      text: "Green lanes are moving, amber lanes are clearing or building queues, and red stop-bars are held at red.",
    },
    {
      title: "Fallback safety",
      text: live.source === "google_routes"
        ? "Google traffic is live. If it drops later, the dashboard can fall back without breaking the display."
        : "Google is unavailable right now, so the dashboard is running on the fallback data path.",
    },
  ];

  els.notesGrid.innerHTML = notes
    .map((note) => `
      <article class="note-card">
        <h3>${note.title}</h3>
        <p>${note.text}</p>
      </article>
    `)
    .join("");
}

function renderMapStory(live) {
  const plan = live.signal_plan || {};
  const googleDirection = live.insights?.google_delay_direction;
  const queueDirection = live.insights?.dominant_queue_direction;
  const activeDirections = plan.active_directions?.length ? plan.active_directions.map(directionLabel).join(" + ") : "transition";
  els.mapStory.textContent = `Map view: lane geometry comes from SUMO, Google segments show live corridor speed, current signal phase is ${activeDirections}, and the biggest queue is on ${directionLabel(queueDirection)} while the heaviest Google delay is on ${directionLabel(googleDirection)}.`;
}

function drawProjectedPath(ctx, points, width, height, strokeStyle, lineWidth, alpha = 1) {
  if (!points || points.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const [startX, startY] = projectPoint(points[0].lat, points[0].lon, width, height);
  ctx.moveTo(startX, startY);
  for (let index = 1; index < points.length; index += 1) {
    const [x, y] = projectPoint(points[index].lat, points[index].lon, width, height);
    ctx.lineTo(x, y);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

function drawGoogleCorridors(ctx, width, height, googleSnapshot) {
  Object.values(googleSnapshot || {}).forEach((approach) => {
    const segments = approach.traffic_segments?.length
      ? approach.traffic_segments
      : [{ speed: "NORMAL", points: approach.polyline || [] }];

    segments.forEach((segment) => {
      drawProjectedPath(ctx, segment.points, width, height, googleSegmentColor(segment.speed), 12, 0.12);
      drawProjectedPath(ctx, segment.points, width, height, googleSegmentColor(segment.speed), 5.2, 0.42);
    });
  });
}

function drawLaneStopBar(ctx, lane, width, height, color) {
  const points = lane.shape || [];
  if (points.length < 2) return;
  const [x1, y1] = projectPoint(points[points.length - 2].lat, points[points.length - 2].lon, width, height);
  const [x2, y2] = projectPoint(points[points.length - 1].lat, points[points.length - 1].lon, width, height);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const half = 8;
  ctx.beginPath();
  ctx.moveTo(x2 - nx * half, y2 - ny * half);
  ctx.lineTo(x2 + nx * half, y2 + ny * half);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.stroke();
}

function drawLaneQueueBubble(ctx, lane, metric, width, height) {
  if (!metric || !(metric.queue_vehicles > 0)) return;
  const anchor = lane.stop_point || lane.anchor;
  if (!anchor) return;
  const [x, y] = projectPoint(anchor.lat, anchor.lon, width, height);
  ctx.fillStyle = "rgba(7, 17, 26, 0.92)";
  ctx.strokeStyle = "rgba(255, 109, 117, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x - 20, y - 26, 40, 18, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffbf69";
  ctx.font = "10px Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${metric.queue_vehicles}q`, x, y - 13);
}

function drawLaneOverlays(ctx, width, height, laneMetrics) {
  // Static lane geometry is drawn from the cached layer.
  // Here we only draw dynamic overlays: signal-state stripes, stop-bars, queue bubbles.
  (state.geometry.lanes || []).forEach((lane) => {
    if (lane.role !== "monitor") return;
    const metric = laneMetrics[lane.id];
    drawProjectedPath(ctx, lane.shape, width, height, laneStatusColor(metric), 2.4, 0.9);
    if (metric?.signal_state && metric.signal_state !== "unknown") {
      drawLaneStopBar(ctx, lane, width, height, laneStatusColor(metric));
    }
    drawLaneQueueBubble(ctx, lane, metric, width, height);
  });
}

function drawVehicles(ctx, width, height, vehicles) {
  (vehicles || []).forEach((vehicle) => {
    const [x, y] = projectPoint(vehicle.lat, vehicle.lon, width, height);
    const speed = vehicle.speed_kmh || 0;
    const color = speed < 4 ? "#ff6d75" : speed < 20 ? "#ffbf69" : "#eff8fb";
    const headingRad = (vehicle.heading_deg || 0) * Math.PI / 180;
    const length = 6.4;
    const widthPx = 3.4;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(headingRad);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -length);
    ctx.lineTo(-widthPx, length * 0.55);
    ctx.lineTo(widthPx, length * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawMarkers(ctx, width, height, live) {
  const center = live.simulation_center;
  const reference = live.site_reference;
  if (center) {
    const [x, y] = projectPoint(center.lat, center.lon, width, height);
    ctx.fillStyle = "#45d5a0";
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#45d5a0";
    ctx.font = "bold 13px 'Avenir Next', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Wadi Saqra Junction", x + 10, y + 4);
  }
  if (reference) {
    const [x, y] = projectPoint(reference.lat, reference.lon, width, height);
    ctx.fillStyle = "#ffbf69";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffbf69";
    ctx.font = "11px Menlo, monospace";
    ctx.fillText("Reference site", x + 8, y + 3);
  }

  const signalPlan = live.signal_plan || {};
  if (center && signalPlan.phase_label) {
    const [x, y] = projectPoint(center.lat, center.lon, width, height);
    ctx.fillStyle = "rgba(6, 16, 23, 0.88)";
    ctx.strokeStyle = "rgba(69, 213, 160, 0.32)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.roundRect(x - 70, y - 48, 140, 34, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#eff8fb";
    ctx.font = "bold 12px 'Avenir Next', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(signalPlan.phase_label, x, y - 28);
    ctx.fillStyle = "#99aeb8";
    ctx.font = "10px Menlo, monospace";
    ctx.fillText(`${Math.round(signalPlan.remaining_s || 0)}s remaining`, x, y - 15);
  }
}

function drawDirectionBadges(ctx, width, height, metrics, googleSnapshot) {
  const badgePositions = [
    { direction: "northbound", x: width * 0.5, y: height * 0.08 },
    { direction: "southbound", x: width * 0.5, y: height * 0.92 },
    { direction: "eastbound", x: width * 0.92, y: height * 0.5 },
    { direction: "westbound", x: width * 0.08, y: height * 0.5 },
  ];

  badgePositions.forEach(({ direction, x, y }) => {
    const metric = metrics[direction] || {};
    const google = googleSnapshot[direction] || {};
    const delayColor = google.congestion_level === "severe" || google.congestion_level === "heavy"
      ? "#ff6d75"
      : google.congestion_level === "moderate"
        ? "#ffbf69"
        : "#45d5a0";

    ctx.save();
    ctx.fillStyle = "rgba(6, 16, 23, 0.84)";
    ctx.strokeStyle = `${delayColor}88`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x - 62, y - 28, 124, 56, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = delayColor;
    ctx.font = "bold 12px 'Avenir Next', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(directionLabel(direction), x, y - 8);
    ctx.fillStyle = "#99aeb8";
    ctx.font = "10px Menlo, monospace";
    ctx.fillText(`${queueDescription(metric.queue_m)} · ${formatDelay(google.delay_s)}`, x, y + 9);
    ctx.restore();
  });
}

// ── Static map layer cache (roads + lanes don't change between SSE ticks) ──
let staticLayerCache = null;
let staticLayerKey = null;

function buildStaticLayer(width, height) {
  // Only roads/lanes are cached. Lane *colors* depend on metrics so live overlays handle that.
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext("2d");
  ctx.fillStyle = getCssVar("--map-bg") || "#07111a";
  ctx.fillRect(0, 0, width, height);
  // Draw lane geometries using a stable role-based color (no signal state)
  (state.geometry?.lanes || []).forEach((lane) => {
    drawProjectedPath(ctx, lane.shape, width, height, "rgba(8, 16, 23, 0.95)", lane.role === "monitor" ? 7.8 : 4.2, 1);
    drawProjectedPath(ctx, lane.shape, width, height, lane.role === "monitor" ? "rgba(194, 209, 218, 0.28)" : "rgba(111, 129, 140, 0.18)", lane.role === "monitor" ? 4.6 : 1.9, 1);
  });
  return offscreen;
}

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function invalidateMapCache() {
  staticLayerCache = null;
  staticLayerKey = null;
}

function drawMap() {
  // Strict 2D top-down: ctx.translate/scale only, no tilt/perspective/rotation
  const canvas = els.mapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const live = state.liveState;
  if (!live || !state.geometry) return;

  // Reuse cached static layer if dimensions and theme match
  const cacheKey = `${width}x${height}:${state.theme}`;
  if (!staticLayerCache || staticLayerKey !== cacheKey) {
    staticLayerCache = buildStaticLayer(width, height);
    staticLayerKey = cacheKey;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getCssVar("--map-bg") || "#07111a";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(mapView.offsetX, mapView.offsetY);
  ctx.scale(mapView.scale, mapView.scale);
  // Draw cached static geometry first (fast blit)
  ctx.drawImage(staticLayerCache, 0, 0);
  drawGoogleCorridors(ctx, width, height, live.google_snapshot || {});
  drawLaneOverlays(ctx, width, height, live.lane_metrics || {});
  drawVehicles(ctx, width, height, live.vehicles || []);
  drawMarkers(ctx, width, height, live);
  ctx.restore();

  drawDirectionBadges(ctx, width, height, live.metrics || {}, live.google_snapshot || {});

  if (state.geometry?.bbox) {
    const bbox = state.geometry.bbox;
    const lonSpan = Math.max(bbox.max_lon - bbox.min_lon, 0.0001);
    const metersPerPx = (lonSpan * 111320 * Math.cos(bbox.min_lat * Math.PI / 180)) / width;
    const barMeters = 200;
    const barPx = barMeters / metersPerPx;
    ctx.strokeStyle = "rgba(239, 248, 251, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, height - 22);
    ctx.lineTo(20 + barPx, height - 22);
    ctx.stroke();
    ctx.fillStyle = "rgba(239, 248, 251, 0.55)";
    ctx.font = "11px Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText("200 m", 20, height - 28);
  }

  ctx.fillStyle = "rgba(153, 174, 184, 0.45)";
  ctx.font = "11px Menlo, monospace";
  ctx.textAlign = "right";
  ctx.fillText(`zoom ×${mapView.scale.toFixed(1)}`, width - 14, height - 24);
  ctx.fillText("Wadi Saqra — Amman, Jordan", width - 14, height - 8);
}

function drawHistory() {
  const canvas = els.historyCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const fullHistory = state.history || [];
  // Slice to last N points for perf (sliding window display)
  const history = fullHistory.length > HISTORY_DRAW_LIMIT
    ? fullHistory.slice(-HISTORY_DRAW_LIMIT)
    : fullHistory;

  const bg = getCssVar("--chart-bg") || "#07111a";
  const grid = getCssVar("--chart-grid") || "rgba(255,255,255,0.07)";
  const queueColor = getCssVar("--chart-queue") || "#ffbf69";
  const speedColor = getCssVar("--chart-speed") || "#45d5a0";
  const forecastColor = getCssVar("--chart-forecast") || "#7ab8ff";

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  if (!history.length) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "12px Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for first state…", width / 2, height / 2);
    return;
  }

  const padding = 28;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  let maxQueue = 1;
  let maxSpeed = 1;
  for (const item of history) {
    if (item.total_queue_m > maxQueue) maxQueue = item.total_queue_m;
    if (item.avg_network_speed_kmh > maxSpeed) maxSpeed = item.avg_network_speed_kmh;
  }

  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let step = 0; step <= 4; step += 1) {
    const y = padding + (usableH / 4) * step;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  const denom = Math.max(history.length - 1, 1);

  ctx.lineWidth = 2.2;
  ctx.strokeStyle = queueColor;
  ctx.beginPath();
  for (let i = 0; i < history.length; i += 1) {
    const value = history[i].total_queue_m || 0;
    const x = padding + (i / denom) * usableW;
    const y = padding + usableH - (value / maxQueue) * usableH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.strokeStyle = speedColor;
  ctx.beginPath();
  for (let i = 0; i < history.length; i += 1) {
    const value = history[i].avg_network_speed_kmh || 0;
    const x = padding + (i / denom) * usableW;
    const y = padding + usableH - (value / maxSpeed) * usableH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Optional forecast overlay (drawn dashed if state.forecast is set)
  if (state.forecast && Array.isArray(state.forecast.points) && state.forecast.points.length) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = forecastColor;
    ctx.beginPath();
    const fcMax = Math.max(maxQueue, ...state.forecast.points.map((p) => p.total_queue_m || 0)) || 1;
    state.forecast.points.forEach((point, idx) => {
      const x = padding + (idx / Math.max(state.forecast.points.length - 1, 1)) * usableW;
      const y = padding + usableH - ((point.total_queue_m || 0) / fcMax) * usableH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = queueColor;
  ctx.font = "11px Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("Queue length", padding, 16);
  ctx.fillStyle = speedColor;
  ctx.fillText("Average network speed", padding + 110, 16);
  if (state.forecast?.points?.length) {
    ctx.fillStyle = forecastColor;
    ctx.fillText("Forecast (15m)", padding + 290, 16);
  }
}

function render() {
  if (!state.liveState || !state.geometry) {
    renderWhatIfPreview(false);
    return;
  }
  const live = state.liveState;
  renderHeader(live);
  renderKpis(live);
  renderSignalPlan(live.signal_plan || {}, live.metrics || {});
  renderAlerts(live.insights?.events || [], live.anomaly);
  renderWebsterPanel(live.signal_recommendation || null, live.signal_plan || null);
  renderApproachTable(live.metrics || {}, live.google_snapshot || {}, live.demand || {});
  renderNotes(live);
  renderMapStory(live);
  if (state.mapMode === "sumo") drawMap();
  drawHistory();
  // Update What-If panel if open
  const panel = document.getElementById("whatif-preview-content");
  if (panel && panel.dataset.forceShow === "true") renderWhatIfPreview(true);
}

function setupMapInteraction() {
  const canvas = els.mapCanvas;
  if (!canvas) return;
  canvas.style.cursor = "grab";

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cursorX = (event.clientX - rect.left) * scaleX;
    const cursorY = (event.clientY - rect.top) * scaleY;
    const factor = event.deltaY < 0 ? 1.14 : 0.88;
    mapView.offsetX = cursorX + (mapView.offsetX - cursorX) * factor;
    mapView.offsetY = cursorY + (mapView.offsetY - cursorY) * factor;
    mapView.scale = Math.max(0.2, Math.min(12, mapView.scale * factor));
    drawMap();
  }, { passive: false });

  canvas.addEventListener("mousedown", (event) => {
    isDragging = true;
    canvas.style.cursor = "grabbing";
    dragStart = { x: event.clientX, y: event.clientY };
    dragViewStart = { offsetX: mapView.offsetX, offsetY: mapView.offsetY };
  });

  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (isDragging) {
      mapView.offsetX = dragViewStart.offsetX + (event.clientX - dragStart.x) * scaleX;
      mapView.offsetY = dragViewStart.offsetY + (event.clientY - dragStart.y) * scaleY;
      drawMap();
    }
    if (state.geometry) {
      const dataX = ((event.clientX - rect.left) * scaleX - mapView.offsetX) / mapView.scale;
      const dataY = ((event.clientY - rect.top) * scaleY - mapView.offsetY) / mapView.scale;
      const latlon = reverseProject(dataX, dataY, canvas.width, canvas.height);
      const coordEl = document.getElementById("map-coords");
      if (coordEl) coordEl.textContent = `Map coordinates: ${latlon.lat.toFixed(5)}, ${latlon.lon.toFixed(5)}`;
    }
  });

  const stopDragging = () => {
    isDragging = false;
    canvas.style.cursor = "grab";
  };
  canvas.addEventListener("mouseup", stopDragging);
  canvas.addEventListener("mouseleave", stopDragging);

  document.getElementById("map-zoom-in")?.addEventListener("click", () => {
    mapView.scale = Math.min(12, mapView.scale * 1.3);
    drawMap();
  });
  document.getElementById("map-zoom-out")?.addEventListener("click", () => {
    mapView.scale = Math.max(0.2, mapView.scale * 0.77);
    drawMap();
  });
  document.getElementById("map-reset")?.addEventListener("click", () => {
    mapView.scale = 1;
    mapView.offsetX = 0;
    mapView.offsetY = 0;
    drawMap();
  });
}

// ── SSE with auto-reconnect + render throttling ──────────────
function scheduleRender() {
  if (state.pendingRender) return;
  state.pendingRender = true;
  const elapsed = performance.now() - state.lastRenderTs;
  const delay = Math.max(0, RENDER_THROTTLE_MS - elapsed);
  setTimeout(() => {
    state.pendingRender = false;
    state.lastRenderTs = performance.now();
    requestAnimationFrame(render);
  }, delay);
}

function connectEventSource() {
  closeEventSource();
  setConnectionStatus(state.sseReconnectAttempts === 0 ? "connecting" : "reconnecting");

  try {
    state.eventSource = new EventSource("/api/live-events");
  } catch (error) {
    console.error("Failed to open EventSource:", error);
    scheduleSseReconnect();
    return;
  }

  state.eventSource.addEventListener("open", () => {
    if (state.sseReconnectAttempts > 0) {
      showToast("Live connection restored", "success", 2500);
    }
    state.sseReconnectAttempts = 0;
    setConnectionStatus("connected");
  });

  state.eventSource.addEventListener("state", (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      console.warn("Bad SSE payload", err);
      return;
    }
    state.liveState = payload;
    const insights = payload.insights || {};
    state.history.push({
      wall_time: payload.wall_time,
      total_queue_m: insights.total_queue_m || 0,
      avg_network_speed_kmh: insights.avg_network_speed_kmh || 0,
      total_vehicles: (payload.vehicles && payload.vehicles.length) || 0,
    });
    if (state.history.length > HISTORY_MAX_POINTS) {
      state.history = state.history.slice(-HISTORY_MAX_POINTS);
    }
    scheduleRender();
  });

  state.eventSource.onerror = () => {
    if (state.eventSource && state.eventSource.readyState === EventSource.CLOSED) {
      scheduleSseReconnect();
    } else if (state.eventSource && state.eventSource.readyState === EventSource.CONNECTING) {
      // Browser is auto-retrying; show reconnecting state
      setConnectionStatus("reconnecting");
    }
  };
}

function closeEventSource() {
  if (state.eventSource) {
    try {
      state.eventSource.close();
    } catch {/* noop */}
    state.eventSource = null;
  }
}

function scheduleSseReconnect() {
  closeEventSource();
  if (state.sseReconnectTimer) clearTimeout(state.sseReconnectTimer);
  state.sseReconnectAttempts += 1;
  const backoff = Math.min(
    SSE_RECONNECT_BASE_MS * Math.pow(2, state.sseReconnectAttempts - 1),
    SSE_RECONNECT_MAX_MS,
  );
  setConnectionStatus("reconnecting", `retry ${state.sseReconnectAttempts}`);
  if (state.sseReconnectAttempts === 1) {
    showToast("Live connection lost — reconnecting…", "warn", 2500);
  }
  state.sseReconnectTimer = setTimeout(connectEventSource, backoff);
}

// Reconcile critical state with the server periodically (in case SSE is delayed)
async function reconcileState() {
  try {
    const live = await fetchJSON("/api/live-state", { retries: 1, timeoutMs: 5000 });
    if (live && state.liveState) {
      // Only patch fields that don't change often (adaptive toggle, source)
      state.liveState.adaptive_active = live.adaptive_active;
      state.liveState.source = live.source;
      setAdaptiveBadge();
    }
  } catch {
    // Silent — SSE handler shows the disconnect status
  }
}

async function init() {
  loadStoredTheme();
  setConnectionStatus("connecting");
  const [config, geometry, liveState, history] = await Promise.all([
    fetchJSON("/api/live-config"),
    fetchJSON("/api/network-geometry"),
    fetchJSON("/api/live-state"),
    fetchJSON("/api/live-history"),
  ]);

  state.config = config;
  state.geometry = geometry;
  state.liveState = liveState;
  state.history = Array.isArray(history) ? history : [];
  bindEvents();
  setupMapInteraction();
  invalidateMapCache();
  connectEventSource();
  // Periodic reconciliation (every 30s) for adaptive toggle / source state
  setInterval(reconcileState, 30000);
  // Forecast refresh every 60s (independent of SSE)
  refreshForecast();
  setInterval(refreshForecast, 60_000);
  scheduleRender();
}

init().catch((error) => {
  console.error("init failed", error);
  setConnectionStatus("failed");
  showToast(`Failed to initialize: ${error.message}`, "error", 8000);
  // Soft fail: keep the page so users can retry
  setTimeout(() => init().catch(() => {/* still failing */}), 5000);
});
