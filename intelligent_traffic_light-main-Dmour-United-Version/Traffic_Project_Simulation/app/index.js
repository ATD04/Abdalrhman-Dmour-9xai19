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
  modelEvaluation: null,
  peakHours: null,
  peakScope: "directions",
  peakViewMode: "week",       // "week" | "day"
  peakSelectedDay: "Monday",  // active weekday when in day view
  volumeHeatmap: null,
  trafficCounts: null,
  trafficCountScope: "directions",
  simulationJob: null,
  chatConversationId: null,
  chatHealth: null,
};

const SSE_RECONNECT_BASE_MS = 1500;
const SSE_RECONNECT_MAX_MS = 30000;
const RENDER_THROTTLE_MS = 33; // ~30 Hz
const HISTORY_MAX_POINTS = 600;
const HISTORY_DRAW_LIMIT = 180; // last 3 minutes drawn for perf

const els = {
  sourceBadge: document.getElementById("source-badge"),
  adaptiveToggle: document.getElementById("adaptive-toggle"),
  refreshBadge: document.getElementById("refresh-badge"),
  vehicleCountChip: document.getElementById("vehicle-count-chip"),
  kpiQueue: document.getElementById("kpi-queue"),
  kpiSpeed: document.getElementById("kpi-speed"),
  kpiDominant: document.getElementById("kpi-dominant"),
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
  // Twin tab map
  twinMap: document.getElementById("twin-map"),
  twinVehicleChip: document.getElementById("twin-vehicle-chip"),
  twinMapStory: document.getElementById("twin-map-story"),
  // Analytics tab
  forecastGrid: document.getElementById("forecast-grid"),
  anomalyGrid: document.getElementById("anomaly-grid"),
  congestionShares: document.getElementById("congestion-shares"),
  vehicleDistribution: document.getElementById("vehicle-distribution"),
  modelAccuracy: document.getElementById("model-accuracy"),
  demandPressure: document.getElementById("demand-pressure"),
  trafficCountsGrid: document.getElementById("traffic-counts-grid"),
  trafficCountsDirections: document.getElementById("traffic-counts-directions"),
  trafficCountsApproaches: document.getElementById("traffic-counts-approaches"),
  peakHoursChart: document.getElementById("peak-hours-chart"),
  peakHoursDirections: document.getElementById("peak-hours-directions"),
  peakHoursApproaches: document.getElementById("peak-hours-approaches"),
  peakHoursGrid: document.getElementById("peak-hours-grid"),
  volumeHeatmap: document.getElementById("volume-heatmap"),
  laneOccupancy: document.getElementById("lane-occupancy"),
  analyticsHistoryCanvas: document.getElementById("analytics-history-chart"),
  forecastModeBadge: document.getElementById("forecast-mode-badge"),
  simulationStatus: document.getElementById("simulation-status"),
  simNsGreen: document.getElementById("sim-ns-green"),
  simEGreen: document.getElementById("sim-e-green"),
  simWGreen: document.getElementById("sim-w-green"),
  simDuration: document.getElementById("sim-duration"),
  simNsValue: document.getElementById("sim-ns-value"),
  simEValue: document.getElementById("sim-e-value"),
  simWValue: document.getElementById("sim-w-value"),
  simEngineInput: document.getElementById("sim-engine"),
  simEngineHelp: document.getElementById("sim-engine-help"),
  simRun: document.getElementById("sim-run"),
  simRebalance: document.getElementById("sim-rebalance"),
  simulationCanvas: document.getElementById("simulation-canvas"),
  simulationSummary: document.getElementById("simulation-summary"),
};

const directions = ["northbound", "southbound", "eastbound", "westbound"];
const DIRECTION_LABELS = {
  northbound: "North",
  southbound: "South",
  eastbound: "East",
  westbound: "West",
};
const DIRECTION_ARROWS = {
  northbound: "↑",
  southbound: "↓",
  eastbound: "→",
  westbound: "←",
};
const CONGESTION_LABELS = {
  free: "Free flow",
  light: "Light traffic",
  moderate: "Moderate delay",
  heavy: "Heavy delay",
  severe: "Severe jam",
};
const SIGNAL_STATE_LABELS = {
  green: "Moving",
  yellow: "Clearing",
  red: "Stopped",
  unknown: "No signal data",
};
const GOOGLE_SEGMENT_COLORS = {
  NORMAL: "#45d5a0",
  SLOW: "#ffbf69",
  TRAFFIC_JAM: "#ff6d75",
};
const SIM_ENGINE_OPTIONS = {
  math: {
    label: "Quick Estimate",
    badge: "Fast HCM model",
    description: "Runs the calibrated HCM delay and queue model. Best for quick comparison across many timing ideas.",
    eta: "Usually finishes in under 2 seconds.",
  },
  sumo: {
    label: "Detailed Digital Twin",
    badge: "SUMO micro-simulation",
    description: "Runs the scenario through the lane-level SUMO traffic engine. Best when you need the most realistic vehicle-by-vehicle view.",
    eta: "Can take several seconds while the digital twin is prepared.",
  },
};
const mapView = { scale: 1, offsetX: 0, offsetY: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let dragViewStart = { offsetX: 0, offsetY: 0 };
let simulationPollToken = 0;

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
  return `${DIRECTION_LABELS[direction] || direction} ${DIRECTION_ARROWS[direction] || ""}`.trim();
}

function signalBadge(stateName) {
  const label = SIGNAL_STATE_LABELS[stateName] || SIGNAL_STATE_LABELS.unknown;
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
  els.adaptiveToggle.textContent = `Adaptive: ${active ? "ON" : "OFF"}`;
}

function getLiveBaselineGreens() {
  const plan = state.liveState?.signal_plan || {};
  const applied = plan.applied_greens || {};
  const phases = state.liveState?.signal_recommendation?.phases || [];
  const ns = phases.find((p) => (p.directions || []).includes("northbound"));
  const east = phases.find((p) => (p.directions || []).includes("eastbound"));
  const west = phases.find((p) => (p.directions || []).includes("westbound"));
  return {
    ns: Math.round(applied.northbound || ns?.current_green_s || 35),
    east: Math.round(applied.eastbound || east?.current_green_s || 25),
    west: Math.round(applied.westbound || west?.current_green_s || 25),
    source: state.liveState?.source || "—",
  };
}

function updateSimLiveBaseline() {
  const liveEl = document.getElementById("sim-live-values");
  if (!liveEl) return;
  const baseline = getLiveBaselineGreens();
  liveEl.innerHTML = `
    <div class="sim-live-row"><span>شمال/جنوب</span><strong>${baseline.ns}s</strong></div>
    <div class="sim-live-row"><span>شرق</span><strong>${baseline.east}s</strong></div>
    <div class="sim-live-row"><span>غرب</span><strong>${baseline.west}s</strong></div>
    <div class="sim-live-row sim-live-src"><span>المصدر</span><strong>${baseline.source}</strong></div>`;
}

function readSimulationPayloadFromUi(engine = getSelectedSimulationEngine()) {
  return {
    ns_green: Number(els.simNsGreen?.value || 35),
    e_green: Number(els.simEGreen?.value || 25),
    w_green: Number(els.simWGreen?.value || 25),
    duration_s: Number(els.simDuration?.value || 180),
    seed: 42,
    engine,
  };
}

function getSelectedSimulationEngine() {
  const checked = document.querySelector('input[name="sim-engine-option"]:checked');
  const value = checked?.value || els.simEngineInput?.value || "math";
  return SIM_ENGINE_OPTIONS[value] ? value : "math";
}

function updateSimulationEngineUi(engine = getSelectedSimulationEngine()) {
  if (els.simEngineInput) {
    els.simEngineInput.value = engine;
  }
  document.querySelectorAll(".sim-engine-card[data-engine]").forEach((card) => {
    const active = card.getAttribute("data-engine") === engine;
    card.classList.toggle("active", active);
    card.setAttribute("aria-checked", active ? "true" : "false");
    const radio = card.querySelector('input[name="sim-engine-option"]');
    if (radio) {
      radio.checked = active;
    }
  });
  if (els.simEngineHelp) {
    const meta = SIM_ENGINE_OPTIONS[engine] || SIM_ENGINE_OPTIONS.math;
    els.simEngineHelp.textContent = `${meta.description} ${meta.eta}`;
  }
}

function drawSimulationPendingFrame(engine, request) {
  const canvas = els.simulationCanvas;
  const chartEl = document.getElementById("sim-queue-chart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const dividerX = Math.floor(W / 2);
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const baseline = getLiveBaselineGreens();
  const meta = SIM_ENGINE_OPTIONS[engine] || SIM_ENGINE_OPTIONS.math;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = isDark ? "#0b1620" : "#e6edf5";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)";
  ctx.fillRect(dividerX - 1, 0, 2, H);

  const drawCard = (x, y, width, height, title, subtitle, rows, accent) => {
    ctx.save();
    ctx.fillStyle = isDark ? "rgba(12, 24, 36, 0.88)" : "rgba(255,255,255,0.78)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, width, height, 18);
    else ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = "bold 16px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(title, x + 18, y + 28);

    ctx.fillStyle = isDark ? "rgba(226,232,240,0.72)" : "rgba(51,65,85,0.82)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(subtitle, x + 18, y + 50);

    ctx.fillStyle = isDark ? "rgba(241,245,249,0.95)" : "rgba(15,23,42,0.95)";
    ctx.font = "600 15px system-ui, sans-serif";
    rows.forEach((row, index) => {
      const rowY = y + 88 + index * 34;
      ctx.fillText(row.label, x + 18, rowY);
      ctx.textAlign = "right";
      ctx.fillText(`${row.value}s`, x + width - 18, rowY);
      ctx.textAlign = "left";
    });
    ctx.restore();
  };

  drawCard(
    24,
    62,
    dividerX - 42,
    166,
    "Current Live Plan",
    `Reference from ${baseline.source}`,
    [
      { label: "North/South", value: baseline.ns },
      { label: "East", value: baseline.east },
      { label: "West", value: baseline.west },
    ],
    isDark ? "rgba(148, 163, 184, 0.92)" : "rgba(71, 85, 105, 0.92)"
  );
  drawCard(
    dividerX + 18,
    62,
    dividerX - 42,
    166,
    "Proposed Plan",
    meta.label,
    [
      { label: "North/South", value: request.ns_green },
      { label: "East", value: request.e_green },
      { label: "West", value: request.w_green },
    ],
    isDark ? "rgba(96, 165, 250, 0.98)" : "rgba(37, 99, 235, 0.92)"
  );

  ctx.fillStyle = isDark ? "rgba(241,245,249,0.92)" : "rgba(15,23,42,0.92)";
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Preparing simulation preview…", W / 2, 288);

  ctx.fillStyle = isDark ? "rgba(148,163,184,0.85)" : "rgba(71,85,105,0.82)";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText(meta.description, W / 2, 316);
  ctx.fillText(meta.eta, W / 2, 340);

  if (chartEl) {
    chartEl.width = chartEl.offsetWidth || 900;
    chartEl.height = 110;
    const chart = chartEl.getContext("2d");
    chart.clearRect(0, 0, chartEl.width, chartEl.height);
    chart.fillStyle = isDark ? "rgba(12,24,36,0.72)" : "rgba(255,255,255,0.72)";
    chart.fillRect(0, 0, chartEl.width, chartEl.height);
    chart.fillStyle = isDark ? "rgba(148,163,184,0.88)" : "rgba(71,85,105,0.88)";
    chart.font = "12px 'JetBrains Mono', monospace";
    chart.textAlign = "center";
    chart.fillText("Queue chart will appear as soon as the first simulation result is ready.", chartEl.width / 2, chartEl.height / 2 + 4);
  }
}

function renderSimulationPending(engine, request) {
  const meta = SIM_ENGINE_OPTIONS[engine] || SIM_ENGINE_OPTIONS.math;
  drawSimulationPendingFrame(engine, request);
  if (els.simulationSummary) {
    els.simulationSummary.innerHTML = `
      <div class="simulation-pending">
        <strong>Preparing ${meta.label}</strong>
        <p>The simulator is warming up. The preview above already shows the current live plan beside your proposed plan.</p>
        <div class="sim-pending-meta">
          <span class="sim-status-chip">${meta.badge}</span>
          <span class="sim-status-chip">${meta.eta}</span>
        </div>
      </div>`;
  }
}

async function pollSimulationJob(jobId, token) {
  const startedAt = Date.now();
  while (token === simulationPollToken) {
    const response = await fetch(`/api/simulation/what-if/${encodeURIComponent(jobId)}`);
    const job = await response.json();
    if (token !== simulationPollToken) {
      return null;
    }
    state.simulationJob = job;
    if (job.status === "completed") {
      renderSimulationLab();
      return job;
    }
    if (job.status === "failed") {
      throw new Error(job.error || "Simulation failed.");
    }
    if (els.simulationStatus) {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      els.simulationStatus.textContent = `Running · ${elapsed}s`;
      els.simulationStatus.className = "badge badge-warn";
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

function bindEvents() {
  els.adaptiveToggle.addEventListener("click", async () => {
    if (!state.liveState) return;
    const nextState = !state.liveState.adaptive_active;
    els.adaptiveToggle.disabled = true;
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
      els.adaptiveToggle.disabled = false;
    }
  });

  // ── Sensor fusion toggle ─────────────────────────────────────
  const fusionBtn = document.getElementById("fusion-toggle");
  if (fusionBtn) {
    // Read initial state from config
    state.fusionEnabled = false;
    fusionBtn.textContent = "Fusion: OFF";
    fusionBtn.addEventListener("click", async () => {
      fusionBtn.disabled = true;
      try {
        const response = await fetch("/api/fusion-toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !state.fusionEnabled }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        state.fusionEnabled = payload.fusion_enabled;
        fusionBtn.textContent = `Fusion: ${state.fusionEnabled ? "ON" : "OFF"}`;
        fusionBtn.className = `adaptive-button${state.fusionEnabled ? " active" : ""}`;
        showToast(`Sensor fusion ${state.fusionEnabled ? "enabled" : "disabled"}`, "success", 2000);
      } catch (err) {
        showToast(`Failed to toggle fusion: ${err.message}`, "error");
      } finally {
        fusionBtn.disabled = false;
      }
    });
  }

  if (els.trafficCountsDirections && els.trafficCountsApproaches) {
    els.trafficCountsDirections.addEventListener("click", () => {
      state.trafficCountScope = "directions";
      scheduleRender();
    });
    els.trafficCountsApproaches.addEventListener("click", () => {
      state.trafficCountScope = "approaches";
      scheduleRender();
    });
  }

  if (els.peakHoursDirections && els.peakHoursApproaches) {
    els.peakHoursDirections.addEventListener("click", () => {
      state.peakScope = "directions";
      scheduleRender();
    });
    els.peakHoursApproaches.addEventListener("click", () => {
      state.peakScope = "approaches";
      scheduleRender();
    });
  }

  const updateSimLabels = () => {
    if (els.simNsValue && els.simNsGreen) els.simNsValue.textContent = `${els.simNsGreen.value}s`;
    if (els.simEValue && els.simEGreen) els.simEValue.textContent = `${els.simEGreen.value}s`;
    if (els.simWValue && els.simWGreen) els.simWValue.textContent = `${els.simWGreen.value}s`;
  };

  [els.simNsGreen, els.simEGreen, els.simWGreen].forEach((input) => input?.addEventListener("input", updateSimLabels));
  updateSimLabels();
  document.querySelectorAll('.sim-engine-card input[name="sim-engine-option"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateSimulationEngineUi(input.value || "math");
    });
  });
  document.querySelectorAll(".sim-engine-card[data-engine]").forEach((card) => {
    card.addEventListener("click", () => {
      updateSimulationEngineUi(card.getAttribute("data-engine") || "math");
    });
  });
  updateSimulationEngineUi(getSelectedSimulationEngine());
  els.simRebalance?.addEventListener("click", () => {
    // Load live current greens directly into the candidate sliders
    const plan = state.liveState?.signal_plan || {};
    const applied = plan.applied_greens || {};
    const phases = state.liveState?.signal_recommendation?.phases || [];
    const ns = phases.find((p) => (p.directions || []).includes("northbound"));
    const east = phases.find((p) => (p.directions || []).includes("eastbound"));
    const west = phases.find((p) => (p.directions || []).includes("westbound"));
    if (els.simNsGreen) els.simNsGreen.value = Math.round(applied.northbound || ns?.current_green_s || 35);
    if (els.simEGreen)  els.simEGreen.value  = Math.round(applied.eastbound  || east?.current_green_s || 25);
    if (els.simWGreen)  els.simWGreen.value  = Math.round(applied.westbound  || west?.current_green_s || 25);
    updateSimLabels();
  });
  els.simRun?.addEventListener("click", runSimulationScenario);

  // ── Map mode toggle ──────────────────────────────────────────
  els.mapModeSumo.addEventListener("click", () => setMapMode("sumo"));
  els.mapModeSatellite.addEventListener("click", () => setMapMode("satellite"));

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
    case "f":
      document.getElementById("fusion-toggle")?.click();
      break;
    case "?":
      showToast("Shortcuts: M=map, A=adaptive, F=fusion, T=theme, +/-=zoom, 0=reset", "info", 6000);
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
  els.mapModeSumo.classList.toggle("active", mode === "sumo");
  els.mapModeSatellite.classList.toggle("active", mode === "satellite");

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
  const sourceLabel = live.source === "google_routes" ? "Google Routes API"
    : live.source === "google_routes_stale" ? "Google Routes (cached)"
    : live.source === "detector_data" || live.source === "detector_fallback" ? "Detector Data"
    : live.source || "Detector Data";
  setText(bannerLabel, isGoogleLive
    ? stale
      ? "Live corridor snapshot temporarily cached"
      : "Live data from corridor sensors"
    : "Live data from detector sensors");
  setText(bannerDetail, `Wadi Saqra intersection · Source: ${sourceLabel} · refreshed at ${formatTime(live.wall_time)}`);

  setText(els.sourceBadge, `Source: ${sourceLabel}`);
  setClass(els.sourceBadge, `badge ${isGoogleLive ? "badge-live" : "badge-warn"}`);
  setText(els.refreshBadge, `Updated: ${formatTime(live.wall_time)}`);
  setText(els.vehicleCountChip, `${live.vehicles?.length || 0} vehicles in simulation`);

  // ── Stale data warning ─────────────────────────────────────
  const staleBanner = document.getElementById("stale-data-banner");
  if (staleBanner && live.wall_time) {
    const wallTime = new Date(live.wall_time).getTime();
    const now = Date.now();
    const ageSeconds = (now - wallTime) / 1000;
    if (ageSeconds > 15) {
      staleBanner.style.display = "flex";
      staleBanner.textContent = `⚠ Data is ${Math.round(ageSeconds)}s old — simulation may have stopped`;
      staleBanner.className = ageSeconds > 60 ? "stale-banner stale-critical" : "stale-banner stale-warning";
    } else {
      staleBanner.style.display = "none";
    }
  }

  // ── Data source indicator ──────────────────────────────────
  const sourceIndicator = document.getElementById("data-source-indicator");
  if (sourceIndicator) {
    const sourceLabel = live.source === "google_routes" ? "Google Routes (Live)"
      : live.source === "google_routes_stale" ? "Google Routes (Stale)"
      : live.source === "mock" ? "Mock Data (Demo)"
      : live.source === "detector" ? "Detector Data (Historical)"
      : live.source || "Unknown";
    sourceIndicator.textContent = `Data: ${sourceLabel}`;
  }
}

function renderKpis(live) {
  const insights = live.insights || {};
  setText(els.kpiQueue, queueDescription(insights.total_queue_m));
  setText(els.kpiSpeed, `${(insights.avg_network_speed_kmh || 0).toFixed(1)} km/h`);
  setText(els.kpiDominant, directionLabel(insights.dominant_queue_direction));
  setText(els.tlsId, live.signal_plan?.tls_id ? "Active junction controller" : "No active controller");
  setText(els.googleErrorChip, live.source === "google_routes" ? "Google live" : "Using fallback");
  setClass(els.googleErrorChip, `badge ${live.source === "google_routes" ? "badge-live" : "badge-warn"}`);
  setText(els.recommendation, insights.recommendation || "No active recommendation.");
  setAdaptiveBadge();

  // Emissions logic removed

  // Forecast (cached fetch — refreshed periodically) with confidence intervals
  if (els.kpiForecast && state.forecast) {
    const dom = insights.dominant_queue_direction || "northbound";
    const dirForecasts = state.forecast.directions?.[dom] || [];
    const fc15 = dirForecasts.find((p) => p.horizon_minutes === 15) || dirForecasts[0];
    if (fc15) {
      setText(els.kpiForecast, `${Math.round(fc15.veh_per_hour)} veh/h`);
      const bounds = fc15.lower_bound != null && fc15.upper_bound != null
        ? ` [${Math.round(fc15.lower_bound)}–${Math.round(fc15.upper_bound)}]`
        : "";
      setText(els.kpiForecastDetail, `${directionLabel(dom)} · ${state.forecast.mode} · conf ${(fc15.confidence * 100).toFixed(0)}%${bounds}`);
    }
  }

  // Model accuracy KPI (loaded from cached evaluation)
  const kpiAccuracy = document.getElementById("kpi-accuracy");
  const kpiAccuracyDetail = document.getElementById("kpi-accuracy-detail");
  if (kpiAccuracy && state.modelEvaluation) {
    const eval_ = state.modelEvaluation;
    if (eval_.forecasting) {
      const dirs = Object.values(eval_.forecasting);
      if (dirs.length) {
        const avgMae = dirs.reduce((s, d) => s + (d.mae_veh_h || 0), 0) / dirs.length;
        const avgRmse = dirs.reduce((s, d) => s + (d.rmse_veh_h || 0), 0) / dirs.length;
        setText(kpiAccuracy, `MAE ${avgMae.toFixed(0)} veh/h`);
        setText(kpiAccuracyDetail, `RMSE ${avgRmse.toFixed(0)} · ${dirs.length} directions · ${eval_.cv_splits || "?"}‑fold CV`);
      }
    } else if (eval_.overall_mae_veh_h != null) {
      setText(kpiAccuracy, `MAE ${eval_.overall_mae_veh_h} veh/h`);
      setText(kpiAccuracyDetail, `Backtest horizon ${eval_.horizon_minutes || 15} min`);
    }
  }

  // Anomaly KPI
  const kpiAnomaly = document.getElementById("kpi-anomaly");
  const kpiAnomalyDetail = document.getElementById("kpi-anomaly-detail");
  if (kpiAnomaly) {
    const anomaly = live.anomaly;
    if (anomaly) {
      const anomCount = anomaly.any_anomaly
        ? Object.values(anomaly.directions || {}).filter((d) => d.is_anomaly).length
        : 0;
      setText(kpiAnomaly, anomaly.any_anomaly ? `${anomCount} alert(s)` : "Normal");
      setText(kpiAnomalyDetail, `${anomaly.mode || "statistical"} · ${anomaly.summary || ""}`);
      kpiAnomaly.style.color = anomaly.any_anomaly ? "var(--danger)" : "var(--teal)";
    } else {
      setText(kpiAnomaly, "Warming up");
      setText(kpiAnomalyDetail, "Anomaly detector initializing");
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

async function refreshModelEvaluation() {
  try {
    const data = await fetchJSON("/api/model-evaluation", { retries: 1, timeoutMs: 5000 });
    if (data && !data.error) {
      state.modelEvaluation = data;
      scheduleRender();
    }
  } catch {
    // Model evaluation not available yet — non-critical
  }
}

async function refreshHistoricalAnalytics() {
  try {
    const [peakHours, volumeHeatmap] = await Promise.all([
      fetchJSON("/api/analytics/peak-hours", { retries: 1, timeoutMs: 5000 }),
      fetchJSON("/api/analytics/volume-heatmap", { retries: 1, timeoutMs: 5000 }),
    ]);
    state.peakHours = peakHours;
    state.volumeHeatmap = volumeHeatmap;
    scheduleRender();
  } catch {
    // Historical analytics may be unavailable during startup — non-critical
  }
}

async function refreshTrafficCounts() {
  try {
    state.trafficCounts = await fetchJSON("/api/analytics/traffic-counts", { retries: 1, timeoutMs: 5000 });
    scheduleRender();
  } catch {
    // Count analytics can be briefly unavailable during server startup.
  }
}

function renderAlerts(events, anomaly) {
  // Compose final list: rule-based events + AI anomaly callouts + classified incidents
  const aiEvents = [];
  if (anomaly && anomaly.directions) {
    Object.entries(anomaly.directions).forEach(([direction, info]) => {
      if (info && info.is_anomaly) {
        aiEvents.push({
          type: "ai_anomaly",
          severity: info.severity || (info.score >= 0.85 ? "CRITICAL" : "MEDIUM"),
          direction,
          message: info.reason || "AI model flagged this approach as anomalous.",
          tip: `AI score ${(info.score * 100).toFixed(0)}% (${info.severity || "MEDIUM"}). Verify with field cameras.`,
        });
      }
    });
  }
  // Add classified incidents from anomaly detector
  if (anomaly && anomaly.incidents) {
    anomaly.incidents.forEach((inc) => {
      aiEvents.push({
        type: inc.type || "general_anomaly",
        severity: inc.severity || "MEDIUM",
        direction: inc.direction,
        message: inc.recommendation || "Anomalous traffic pattern detected.",
        tip: `Incident: ${(inc.type || "unknown").replace(/_/g, " ")} · Score: ${((inc.score || 0) * 100).toFixed(0)}%`,
      });
    });
  }
  const allEvents = [...(events || []), ...aiEvents];

  els.alertList.innerHTML = "";
  if (!allEvents.length) {
    const quiet = document.createElement("article");
    quiet.className = "alert-card";
    quiet.innerHTML = `
      <strong>Stable</strong>
      <p>No high-priority alert is active right now.</p>
      ${anomaly?.mode ? `<small style="color:var(--muted);">AI monitor mode: ${anomaly.mode}</small>` : ""}
    `;
    els.alertList.appendChild(quiet);
    return;
  }

  const EVENT_ICONS = {
    spillback: "🚨",
    abnormal_stop: "⚠️",
    congestion_surge: "📈",
    heavy_congestion: "🟠",
    ai_anomaly: "🧠",
    queue_spillback: "🚨",
    severe_congestion: "🔴",
    abnormal_stop_vehicle: "⚠️",
    rear_end_risk: "🚗",
    general_anomaly: "ℹ️",
  };
  const SEVERITY_CLASS = {
    CRITICAL: "severity-critical",
    HIGH: "severity-high",
    MEDIUM: "severity-medium",
    LOW: "severity-low",
    critical: "severity-critical",
    high: "severity-high",
    warning: "severity-medium",
    medium: "severity-medium",
    info: "severity-low",
  };

  allEvents.forEach((event) => {
    const card = document.createElement("article");
    const sevClass = SEVERITY_CLASS[event.severity] || "";
    card.className = `alert-card event-card ${sevClass}`;
    const icon = EVENT_ICONS[event.type] || "ℹ️";
    const dirLabel = event.direction ? ` · ${directionLabel(event.direction)}` : "";
    const titleLabel = event.type === "ai_anomaly"
      ? `AI Anomaly Detected${dirLabel}`
      : `${event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}${dirLabel}`;
    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-icon">${icon}</span>
        <strong>${titleLabel}</strong>
      </div>
      <p>${event.message}</p>
      ${event.tip ? `<p class="event-tip">💡 ${event.tip}</p>` : ""}
    `;
    els.alertList.appendChild(card);
  });
  
  if (els.alertList && els.alertList.parentElement) {
    els.alertList.parentElement.scrollTop = els.alertList.parentElement.scrollHeight;
  }
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
  if (!plan?.groups?.length) {
    els.signalPhaseSummary.textContent = "Signal plan is loading…";
    els.signalList.innerHTML = "";
    return;
  }

  const activeText = plan.active_directions?.length
    ? plan.active_directions.map(directionLabel).join(" + ")
    : "Transition / all-stop";
  const countdownSec = Math.round(plan.remaining_s || 0);
  const adaptiveTag = plan.adaptive_applied ? " · Adaptive" : "";
  els.signalPhaseSummary.innerHTML = `
    <strong>${plan.phase_label || "Signal phase"}</strong>
    <span>${signalBadge(plan.phase_kind)}</span>
    <span class="signal-countdown">${countdownSec}s</span>
    <small>${activeText} · cycle ${Math.round(plan.cycle_length_s || 0)}s${plan.extension_applied_s ? ` · +${Math.round(plan.extension_applied_s)}s hold` : ""}${adaptiveTag}</small>
  `;

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
    row.innerHTML = `
      <td><strong>${directionLabel(direction)}</strong></td>
      <td>
        <span class="status-pill status-${google.congestion_level || "free"}">${CONGESTION_LABELS[google.congestion_level] || "—"}</span>
        <div class="table-sub">${formatDelay(google.delay_s)}</div>
      </td>
      <td>${(google.avg_speed_kmh || 0).toFixed(1)} km/h<div class="table-sub">free flow ${(google.free_flow_speed_kmh || 0).toFixed(1)}</div></td>
      <td>${Math.round(demandState.target_veh_h || 0)} veh/h<div class="table-sub">sat ${Math.round((demandState.saturation_ratio || 0) * 100)}% · cap ${Math.round(demandState.capacity_veh_h || demandState.google_capacity_veh_h || 0)}</div></td>
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
      title: "Capacity and saturation",
      text: live.data_provenance?.saturation_ratio || "Saturation shows how close each approach is to its geometry-scaled operating limit.",
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
  const storyText = `Map view: lane geometry comes from SUMO, Google segments show live corridor speed, current signal phase is ${activeDirections}, and the biggest queue is on ${directionLabel(queueDirection)} while the heaviest Google delay is on ${directionLabel(googleDirection)}.`;
  if (els.mapStory) els.mapStory.textContent = storyText;
  if (els.twinMapStory) els.twinMapStory.textContent = storyText;
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
      const color = googleSegmentColor(segment.speed);
      const isJam = segment.speed === 'TRAFFIC_JAM';
      const isSlow = segment.speed === 'SLOW';
      // Outer glow (wider, transparent)
      drawProjectedPath(ctx, segment.points, width, height, color, 16, 0.08);
      // Middle layer
      drawProjectedPath(ctx, segment.points, width, height, color, 8, isJam ? 0.35 : 0.2);
      // Core line
      drawProjectedPath(ctx, segment.points, width, height, color, 4, isJam ? 0.75 : isSlow ? 0.55 : 0.4);
      // Bright center
      drawProjectedPath(ctx, segment.points, width, height, '#ffffff', 1.5, isJam ? 0.15 : 0.06);
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
  const qv = metric.queue_vehicles;
  const severity = qv > 8 ? '#ef4444' : qv > 4 ? '#f59e0b' : '#22c55e';

  ctx.fillStyle = 'rgba(10,14,26,0.9)';
  ctx.strokeStyle = severity + '66';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 22, y - 28, 44, 20, 6);
  else ctx.fillRect(x - 22, y - 28, 44, 20);
  ctx.fill();
  ctx.stroke();

  // Vehicle icon + count
  ctx.fillStyle = severity;
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${qv} 🚗`, x, y - 14);
}

function drawLaneOverlays(ctx, width, height, laneMetrics) {
  // Static lane geometry is drawn from the cached layer.
  // Here we draw dynamic overlays: signal-state glow, stop-bars, queue bubbles.
  (state.geometry.lanes || []).forEach((lane) => {
    if (lane.role !== "monitor") return;
    const metric = laneMetrics[lane.id];
    const color = laneStatusColor(metric);

    // Signal-state color band (wider, with glow)
    if (metric?.signal_state === 'green') {
      drawProjectedPath(ctx, lane.shape, width, height, '#22c55e', 5, 0.15); // glow
    } else if (metric?.signal_state === 'red') {
      drawProjectedPath(ctx, lane.shape, width, height, '#ef4444', 5, 0.12); // glow
    }
    drawProjectedPath(ctx, lane.shape, width, height, color, 3.2, 0.85);

    if (metric?.signal_state && metric.signal_state !== "unknown") {
      drawLaneStopBar(ctx, lane, width, height, color);
    }
    drawLaneQueueBubble(ctx, lane, metric, width, height);
  });
}

// ── Realistic top-down vehicle renderer ──────────────────────
const _VEHICLE_COLORS = [
  '#e8e8e8','#c0c0c0','#2c2c2c','#1a1a2e','#b71c1c','#1565c0',
  '#2e7d32','#f9a825','#4a148c','#bf360c','#004d40','#37474f',
  '#546e7a','#d84315','#1b5e20','#0d47a1','#880e4f','#311b92',
];
const _vehColorCache = new Map();
function _vehColor(id) {
  if (!id) return '#c0c0c0';
  let c = _vehColorCache.get(id);
  if (!c) {
    let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    c = _VEHICLE_COLORS[h % _VEHICLE_COLORS.length];
    _vehColorCache.set(id, c);
    if (_vehColorCache.size > 2000) _vehColorCache.clear();
  }
  return c;
}

function _drawRealisticCar(ctx, x, y, heading, speed, vehType, vehId, scale) {
  const zoom = mapView.scale * (scale || 1);
  const baseLen = vehType === 'bus' ? 14 : vehType === 'truck' ? 12 : vehType === 'motorcycle' ? 6 : 9;
  const baseW = vehType === 'bus' ? 5 : vehType === 'truck' ? 5.2 : vehType === 'motorcycle' ? 2.8 : 4;
  
  // Inverse scale factor for low zooms so cars don't become tiny
  const scaleFactor = Math.max(1.8 / Math.max(zoom, 0.1), Math.min(zoom * 0.8, 2.5));
  const L = baseLen * scaleFactor;
  const W = baseW * scaleFactor;
  const bodyColor = _vehColor(vehId);
  const isStopped = speed < 3;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading * Math.PI / 180);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W/2 + 1, -L/2 + 1, W, L, W * 0.25);
  else ctx.fillRect(-W/2 + 1, -L/2 + 1, W, L);
  ctx.fill();

  // Car body
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W/2, -L/2, W, L, W * 0.28);
  else ctx.fillRect(-W/2, -L/2, W, L);
  ctx.fill();
  ctx.stroke();

  // Windshield (front)
  const wsTop = -L/2 + L * 0.12;
  const wsH = L * 0.22;
  ctx.fillStyle = 'rgba(120,180,220,0.65)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W/2 + W*0.12, wsTop, W * 0.76, wsH, 2);
  else ctx.fillRect(-W/2 + W*0.12, wsTop, W * 0.76, wsH);
  ctx.fill();

  // Rear window
  const rwTop = L/2 - L * 0.28;
  const rwH = L * 0.16;
  ctx.fillStyle = 'rgba(100,160,200,0.45)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W/2 + W*0.15, rwTop, W * 0.7, rwH, 2);
  else ctx.fillRect(-W/2 + W*0.15, rwTop, W * 0.7, rwH);
  ctx.fill();

  // Headlights (front - always on)
  const hlY = -L/2 + 1;
  const hlW = W * 0.22;
  const hlH = L * 0.06;
  ctx.fillStyle = isStopped ? 'rgba(255,240,200,0.7)' : 'rgba(255,255,220,0.95)';
  ctx.shadowColor = 'rgba(255,255,200,0.5)';
  ctx.shadowBlur = isStopped ? 2 : 5;
  ctx.fillRect(-W/2 + 1, hlY, hlW, hlH);
  ctx.fillRect(W/2 - hlW - 1, hlY, hlW, hlH);
  ctx.shadowBlur = 0;

  // Taillights (rear - brighter when stopped)
  const tlY = L/2 - L * 0.06;
  ctx.fillStyle = isStopped ? '#ff2020' : 'rgba(200,40,40,0.65)';
  ctx.shadowColor = isStopped ? 'rgba(255,0,0,0.6)' : 'rgba(200,0,0,0.2)';
  ctx.shadowBlur = isStopped ? 6 : 2;
  ctx.fillRect(-W/2 + 1, tlY, hlW, hlH);
  ctx.fillRect(W/2 - hlW - 1, tlY, hlW, hlH);
  ctx.shadowBlur = 0;

  // Roof highlight
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-W*0.2, -L*0.1, W*0.4, L*0.25, 2);
  else ctx.fillRect(-W*0.2, -L*0.1, W*0.4, L*0.25);
  ctx.fill();

  ctx.restore();
}

function drawVehicles(ctx, width, height, vehicles) {
  if (!vehicles || !vehicles.length) return;
  // Sort by latitude so "further" vehicles are drawn first (painter's algorithm)
  const sorted = [...vehicles].sort((a, b) => (b.lat || 0) - (a.lat || 0));
  sorted.forEach((v) => {
    const [x, y] = projectPoint(v.lat, v.lon, width, height);
    _drawRealisticCar(ctx, x, y, v.heading_deg || 0, v.speed_kmh || 0, v.type || 'passenger', v.id || '', 1);
  });
}

function drawMarkers(ctx, width, height, live) {
  const center = live.simulation_center;
  const reference = live.site_reference;

  // Draw intersection marker with pulsing ring
  if (center) {
    const [x, y] = projectPoint(center.lat, center.lon, width, height);
    const pulse = Math.sin(Date.now() / 800) * 0.3 + 0.7;

    // Outer glow ring
    ctx.strokeStyle = `rgba(6, 214, 160, ${0.15 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 14 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Inner solid dot
    ctx.fillStyle = '#06d6a0';
    ctx.shadowColor = 'rgba(6,214,160,0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Label with frosted background
    const label = 'Wadi Saqra Junction';
    ctx.font = "bold 12px 'Inter', sans-serif";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(10,14,26,0.82)';
    ctx.strokeStyle = 'rgba(6,214,160,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x + 12, y - 10, tw + 16, 22, 6);
    else ctx.fillRect(x + 12, y - 10, tw + 16, 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#06d6a0';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 20, y + 5);
  }

  if (reference) {
    const [x, y] = projectPoint(reference.lat, reference.lon, width, height);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Signal phase HUD at junction center
  const signalPlan = live.signal_plan || {};
  if (center && signalPlan.phase_label) {
    const [x, y] = projectPoint(center.lat, center.lon, width, height);
    const remaining = Math.round(signalPlan.remaining_s || 0);
    const phaseKind = signalPlan.phase_kind || 'unknown';
    const phaseColor = phaseKind === 'green' ? '#22c55e' : phaseKind === 'yellow' ? '#eab308' : '#ef4444';

    // HUD card
    ctx.fillStyle = 'rgba(10,14,26,0.92)';
    ctx.strokeStyle = phaseColor + '44';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - 80, y - 55, 160, 40, 10);
    else ctx.fillRect(x - 80, y - 55, 160, 40);
    ctx.fill(); ctx.stroke();

    // Phase indicator dot
    ctx.fillStyle = phaseColor;
    ctx.shadowColor = phaseColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x - 65, y - 35, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Phase text
    ctx.fillStyle = '#f1f5f9';
    ctx.font = "bold 11px 'Inter', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillText(signalPlan.phase_label, x - 55, y - 39);

    // Countdown
    ctx.fillStyle = phaseColor;
    ctx.font = "bold 14px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.fillText(`${remaining}s`, x + 72, y - 32);

    // Progress bar
    const cycle = signalPlan.cycle_length_s || 120;
    const progress = Math.max(0, Math.min(1, 1 - remaining / Math.max(cycle * 0.3, 1)));
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - 72, y - 22, 144, 4, 2); ctx.fill(); }
    else ctx.fillRect(x - 72, y - 22, 144, 4);
    ctx.fillStyle = phaseColor + 'cc';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - 72, y - 22, 144 * progress, 4, 2); ctx.fill(); }
    else ctx.fillRect(x - 72, y - 22, 144 * progress, 4);
  }
}

function drawDirectionBadges(ctx, width, height, metrics, googleSnapshot) {
  const badgePositions = [
    { direction: 'northbound', x: width * 0.5, y: height * 0.06, arrow: '↑' },
    { direction: 'southbound', x: width * 0.5, y: height * 0.94, arrow: '↓' },
    { direction: 'eastbound', x: width * 0.93, y: height * 0.5, arrow: '→' },
    { direction: 'westbound', x: width * 0.07, y: height * 0.5, arrow: '←' },
  ];

  badgePositions.forEach(({ direction, x, y, arrow }) => {
    const metric = metrics[direction] || {};
    const google = googleSnapshot[direction] || {};
    const queueM = Math.round(metric.queue_m || 0);
    const speedKmh = (metric.avg_speed_kmh || 0).toFixed(0);
    const flowVehH = Math.round(metric.flow_veh_h || 0);
    const congLevel = google.congestion_level || 'free';
    const delayS = Math.round(google.delay_s || 0);

    const statusColors = {
      free: '#22c55e', light: '#4ade80', moderate: '#f59e0b', heavy: '#f97316', severe: '#ef4444'
    };
    const statusColor = statusColors[congLevel] || '#22c55e';

    const cW = 140, cH = 64;
    ctx.save();

    // Frosted glass card
    ctx.fillStyle = 'rgba(10,14,26,0.88)';
    ctx.strokeStyle = statusColor + '55';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - cW/2, y - cH/2, cW, cH, 10);
    else ctx.fillRect(x - cW/2, y - cH/2, cW, cH);
    ctx.fill(); ctx.stroke();

    // Status bar at top
    ctx.fillStyle = statusColor + '30';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - cW/2, y - cH/2, cW, 3, [10,10,0,0]); ctx.fill(); }
    ctx.fillStyle = statusColor;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - cW/2, y - cH/2, cW, 2, [10,10,0,0]); ctx.fill(); }

    // Direction label
    ctx.fillStyle = statusColor;
    ctx.font = "bold 12px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${arrow} ${DIRECTION_LABELS[direction]}`, x, y - cH/2 + 18);

    // Main metric - queue
    ctx.fillStyle = '#f1f5f9';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(queueM ? `${queueM}m queue` : 'Clear', x, y - cH/2 + 34);

    // Sub metrics
    ctx.fillStyle = '#94a3b8';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${speedKmh} km/h · ${flowVehH} v/h${delayS ? ` · +${delayS}s` : ''}`, x, y - cH/2 + 48);

    // Vehicle count indicator dots
    const vehCount = metric.vehicles_on_approach || 0;
    if (vehCount > 0) {
      const dotCount = Math.min(8, Math.ceil(vehCount / 3));
      const dotStartX = x - (dotCount * 5) / 2;
      for (let i = 0; i < dotCount; i++) {
        ctx.fillStyle = statusColor + 'cc';
        ctx.beginPath();
        ctx.arc(dotStartX + i * 5, y + cH/2 - 7, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  });
}

// ── Static map layer cache (roads + lanes don't change between SSE ticks) ──
let staticLayerCache = null;
let staticLayerKey = null;

function buildStaticLayer(width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  const isDark = (document.documentElement.getAttribute('data-theme') !== 'light');

  // Background with subtle gradient
  const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.7);
  if (isDark) {
    bgGrad.addColorStop(0, '#0f1729');
    bgGrad.addColorStop(1, '#080d18');
  } else {
    bgGrad.addColorStop(0, '#e8eef4');
    bgGrad.addColorStop(1, '#d1dbe6');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle grid pattern for spatial reference
  ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.03)' : 'rgba(15,23,42,0.04)';
  ctx.lineWidth = 0.5;
  const gridStep = 40;
  for (let gx = 0; gx < width; gx += gridStep) {
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, height); ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += gridStep) {
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke();
  }

  // Draw lanes with realistic asphalt look
  const lanes = state.geometry?.lanes || [];
  // Pass 1: Road bed (wider, darker)
  lanes.forEach((lane) => {
    const roadW = lane.role === 'monitor' ? 11 : 6;
    drawProjectedPath(ctx, lane.shape, width, height,
      isDark ? 'rgba(20,30,45,0.95)' : 'rgba(70,85,100,0.35)', roadW, 1);
  });
  // Pass 2: Asphalt surface
  lanes.forEach((lane) => {
    const laneW = lane.role === 'monitor' ? 7 : 3.5;
    const laneColor = lane.role === 'monitor'
      ? (isDark ? 'rgba(50,65,85,0.7)' : 'rgba(100,115,135,0.45)')
      : (isDark ? 'rgba(40,55,70,0.45)' : 'rgba(120,135,150,0.3)');
    drawProjectedPath(ctx, lane.shape, width, height, laneColor, laneW, 1);
  });
  // Pass 3: Center lane markings (dashed white)
  lanes.forEach((lane) => {
    if (lane.role !== 'monitor') return;
    const points = lane.shape;
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.setLineDash([6, 8]);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const [sx, sy] = projectPoint(points[0].lat, points[0].lon, width, height);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = projectPoint(points[i].lat, points[i].lon, width, height);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  });
  // Pass 4: Road edge lines (solid white)
  lanes.forEach((lane) => {
    if (lane.role !== 'monitor') return;
    drawProjectedPath(ctx, lane.shape, width, height,
      isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)', 8.5, 1);
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
  const canvas = els.mapCanvas;
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

  // ── HUD Overlay ──────────────────────────────────────────────
  const isDark = state.theme !== 'light';

  // Scale bar (bottom-left)
  if (state.geometry?.bbox) {
    const bbox = state.geometry.bbox;
    const lonSpan = Math.max(bbox.max_lon - bbox.min_lon, 0.0001);
    const metersPerPx = (lonSpan * 111320 * Math.cos(bbox.min_lat * Math.PI / 180)) / width;
    const barMeters = 200;
    const barPx = barMeters / metersPerPx;

    // Scale bar background
    ctx.fillStyle = 'rgba(10,14,26,0.75)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(12, height - 40, barPx + 20, 30, 6); ctx.fill(); }

    ctx.strokeStyle = isDark ? "rgba(148,163,184,0.6)" : "rgba(71,85,105,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(22, height - 18);
    ctx.lineTo(22 + barPx, height - 18);
    // End caps
    ctx.moveTo(22, height - 22); ctx.lineTo(22, height - 14);
    ctx.moveTo(22 + barPx, height - 22); ctx.lineTo(22 + barPx, height - 14);
    ctx.stroke();

    ctx.fillStyle = isDark ? "rgba(241,245,249,0.7)" : "rgba(15,23,42,0.7)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("200 m", 22 + barPx / 2, height - 24);
  }

  // Bottom-right info card
  const vehCount = live.vehicles?.length || 0;
  const sourceLabel = live.source === "google_routes" ? "GOOGLE LIVE"
    : live.source === "google_routes_stale" ? "GOOGLE CACHED"
    : live.source === "detector_data" || live.source === "detector_fallback" ? "DETECTOR"
    : "FALLBACK";
  const isLive = live.source === "google_routes";

  ctx.fillStyle = 'rgba(10,14,26,0.8)';
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(width - 220, height - 40, 208, 30, 6); ctx.fill(); }

  // Source indicator dot
  ctx.fillStyle = isLive ? '#22c55e' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(width - 208, height - 25, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isDark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)';
  ctx.font = "9px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`${sourceLabel} · ${vehCount} vehicles · ×${mapView.scale.toFixed(1)}`, width - 200, height - 21);

  ctx.fillStyle = isDark ? 'rgba(100,116,139,0.5)' : 'rgba(100,116,139,0.5)';
  ctx.font = "8px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText("Wadi Saqra · Amman, Jordan", width - 16, height - 8);
}

function drawMapOnCanvas(targetCanvas) {
  if (!targetCanvas || !els.mapCanvas) return;
  drawMap();
  const ctx = targetCanvas.getContext("2d");
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(els.mapCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
}

function drawHistory() {
  const canvas = els.historyCanvas;
  if (!canvas) return;
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
  if (!state.liveState || !state.geometry) return;
  const live = state.liveState;
  try { renderHeader(live); } catch (e) { console.error("renderHeader:", e); }
  try { renderKpis(live); } catch (e) { console.error("renderKpis:", e); }
  try { renderSignalPlan(live.signal_plan || {}, live.metrics || {}); } catch (e) { console.error("renderSignalPlan:", e); }
  try { renderAlerts(live.insights?.events || [], live.anomaly); } catch (e) { console.error("renderAlerts:", e); }
  try { renderWebsterPanel(live.signal_recommendation || null, live.signal_plan || null); } catch (e) { console.error("renderWebsterPanel:", e); }
  try { renderApproachTable(live.metrics || {}, live.google_snapshot || {}, live.demand || {}); } catch (e) { console.error("renderApproachTable:", e); }
  try { renderNotes(live); } catch (e) { console.error("renderNotes:", e); }
  try { renderMapStory(live); } catch (e) { console.error("renderMapStory:", e); }
  try { if (state.mapMode === "sumo") drawMap(); } catch (e) { console.error("drawMap:", e); }
  try { drawHistory(); } catch (e) { console.error("drawHistory:", e); }
  // Twin tab
  try { setText(els.twinVehicleChip, `${live.vehicles?.length || 0} vehicles`); } catch (e) {}
  try { setText(els.twinMapStory, els.mapStory?.textContent || ""); } catch (e) {}
  // Analytics tab
  try { renderAnalyticsForecast(); } catch (e) { console.error("renderAnalyticsForecast:", e); }
  
  try { renderAnalyticsAnomaly(live); } catch (e) { console.error("renderAnalyticsAnomaly:", e); }
  try { renderCongestionShares(live); } catch (e) { console.error("renderCongestionShares:", e); }
  try { renderTrafficCounts(); } catch (e) { console.error("renderTrafficCounts:", e); }
  try { renderVehicleDistribution(live); } catch (e) { console.error("renderVehicleDistribution:", e); }
  try { renderDemandPressure(live); } catch (e) { console.error("renderDemandPressure:", e); }
  try { renderPeakHours(); } catch (e) { console.error("renderPeakHours:", e); }
  try { renderVolumeHeatmap(); } catch (e) { console.error("renderVolumeHeatmap:", e); }
  try { renderLaneOccupancy(live); } catch (e) { console.error("renderLaneOccupancy:", e); }
  try { renderModelAccuracyPanel(); } catch (e) { console.error("renderModelAccuracy:", e); }
  try { renderSimulationLab(); } catch (e) { console.error("renderSimulationLab:", e); }
  try { updateSimLiveBaseline(); } catch (e) { /* silent */ }
  try { renderSystemTab(live); } catch (e) { console.error("renderSystemTab:", e); }
}

// ── Analytics Tab: Forecast per direction ─────────────────────
function renderAnalyticsForecast() {
  if (!els.forecastGrid || !state.forecast?.directions) return;
  const ARROWS = { northbound: "↑ North", southbound: "↓ South", eastbound: "→ East", westbound: "← West" };
  let html = "";
  for (const dir of directions) {
    const horizons = state.forecast.directions[dir] || [];
    if (!horizons.length) continue;
    const maxVeh = Math.max(...horizons.map(h => h.veh_per_hour || 0), 1);
    let rows = "";
    for (const h of horizons) {
      const pct = Math.round(((h.veh_per_hour || 0) / maxVeh) * 100);
      const conf = h.confidence != null ? `${(h.confidence * 100).toFixed(0)}%` : "--";
      const bounds = h.lower_bound != null && h.upper_bound != null
        ? `[${Math.round(h.lower_bound)}–${Math.round(h.upper_bound)}]` : "";
      rows += `<div class="fc-horizon">
        <span class="fc-horizon-label">${h.horizon_minutes || "?"}min</span>
        <div class="fc-horizon-bar"><div class="fc-horizon-fill" style="width:${pct}%"></div></div>
        <span class="fc-horizon-val">${Math.round(h.veh_per_hour)} v/h</span>
      </div>
      <div class="fc-conf">${bounds} conf ${conf}</div>`;
    }
    html += `<div class="forecast-card"><div class="fc-dir">${ARROWS[dir] || dir}</div><div class="fc-horizons">${rows}</div></div>`;
  }
  els.forecastGrid.innerHTML = html || '<div class="empty-state">Waiting for forecast data…</div>';
  if (els.forecastModeBadge && state.forecast.mode) setText(els.forecastModeBadge, state.forecast.mode);
}

// ── Analytics Tab: Emissions gauges ──────────────────────────
function renderAnalyticsEmissions(live) {
  if (!els.emissionsGrid) return;
  const em = live.emissions || {};
  if (em.co2_g_per_h === undefined) return;
  const co2_kg = (em.co2_g_per_h || 0) / 1000;
  const nox = em.nox_g_per_h || 0;
  const fuel = em.fuel_l_per_h || 0;
  const fleet = em.fleet_size || 0;
  function gaugeColor(val, max) {
    const ratio = val / max;
    if (ratio < 0.4) return "var(--accent)";
    if (ratio < 0.7) return "var(--warning)";
    return "var(--danger)";
  }
  function makeGauge(label, value, unit, maxVal) {
    const pct = Math.min(100, (value / maxVal) * 100);
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (pct / 100) * circumference;
    const color = gaugeColor(value, maxVal);
    return `<div class="emission-card">
      <div class="gauge-wrap">
        <div class="gauge-ring"><svg viewBox="0 0 100 100">
          <circle class="gauge-bg" cx="50" cy="50" r="42"/>
          <circle class="gauge-fill" cx="50" cy="50" r="42" stroke="${color}"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="gauge-center">
          <span class="gauge-value" style="color:${color}">${value < 10 ? value.toFixed(1) : Math.round(value)}</span>
          <span class="gauge-unit">${unit}</span>
        </div></div>
        <div class="gauge-label">${label}</div>
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px">${fleet} vehicles</div>
    </div>`;
  }
  els.emissionsGrid.innerHTML = makeGauge("CO₂", co2_kg, "kg/h", 50) + makeGauge("NOx", nox, "g/h", 10) + makeGauge("Fuel", fuel, "L/h", 5);
}

// ── Analytics Tab: Anomaly per direction ─────────────────────
function renderAnalyticsAnomaly(live) {
  if (!els.anomalyGrid) return;
  const anomaly = live.anomaly;
  if (!anomaly?.directions) return;
  const ARROWS = { northbound: "↑ N", southbound: "↓ S", eastbound: "→ E", westbound: "← W" };
  let html = "";
  for (const dir of directions) {
    const d = anomaly.directions[dir] || {};
    const score = d.score != null ? (d.score * 100).toFixed(0) : "--";
    const isAnomaly = d.is_anomaly;
    const sev = d.severity || "normal";
    const reason = d.reason || (isAnomaly ? "Anomalous pattern" : "Within expected range");
    const cls = isAnomaly ? "anomaly-active" : "";
    const color = isAnomaly ? "var(--danger)" : "var(--accent)";
    html += `<div class="anomaly-dir-card ${cls}">
      <div class="anomaly-label">${ARROWS[dir] || dir}</div>
      <div class="anomaly-score" style="color:${color}">${score}%</div>
      <div class="anomaly-label">${isAnomaly ? `⚠️ ${sev.toUpperCase()}` : "✅ Normal"}</div>
      <div class="anomaly-reason">${reason}</div>
    </div>`;
  }
  els.anomalyGrid.innerHTML = html;
}

// ── Analytics Tab: Congestion shares ─────────────────────────
function renderCongestionShares(live) {
  if (!els.congestionShares) return;
  const snap = live.google_snapshot || {};
  let html = "";
  for (const dir of directions) {
    const g = snap[dir] || {};
    const normal = ((g.normal_share || 0.85) * 100).toFixed(0);
    const slow = ((g.slow_share || 0.10) * 100).toFixed(0);
    const jam = ((g.jam_share || 0.05) * 100).toFixed(0);
    html += `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:4px;">
        <strong>${directionLabel(dir)}</strong>
        <span class="font-mono text-muted" style="font-size:var(--text-xs)">${CONGESTION_LABELS[g.congestion_level] || "—"}</span>
      </div>
      <div class="congestion-bar">
        <div class="cong-normal" style="width:${normal}%"></div>
        <div class="cong-slow" style="width:${slow}%"></div>
        <div class="cong-jam" style="width:${jam}%"></div>
      </div>
      <div class="congestion-legend">
        <span class="leg-normal">Normal ${normal}%</span>
        <span class="leg-slow">Slow ${slow}%</span>
        <span class="leg-jam">Jam ${jam}%</span>
      </div>
    </div>`;
  }
  els.congestionShares.innerHTML = html;
}

// ── Analytics Tab: Vehicle distribution ──────────────────────
function renderVehicleDistribution(live) {
  if (!els.vehicleDistribution) return;
  const vehicles = live.vehicles || [];
  if (!vehicles.length) return;
  const counts = {};
  for (const v of vehicles) {
    const t = v.type || "default";
    counts[t] = (counts[t] || 0) + 1;
  }
  const ICONS = { passenger: "🚗", bus: "🚌", truck: "🚛", motorcycle: "🏍", default: "🚗" };
  let html = "";
  for (const [type, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    html += `<div class="veh-dist-item">
      <div style="font-size:1.5rem">${ICONS[type] || "🚗"}</div>
      <div class="veh-dist-count">${count}</div>
      <div class="veh-dist-label">${type}</div>
    </div>`;
  }
  els.vehicleDistribution.innerHTML = html;
}

// ── Analytics Tab: Demand pressure ───────────────────────────
function renderDemandPressure(live) {
  if (!els.demandPressure) return;
  const demand = live.demand || {};

  const levelLabel = (p) => p > 0.8 ? "Critical" : p > 0.6 ? "High" : p > 0.4 ? "Moderate" : "Low";
  const levelClass = (p) => p > 0.8 ? "dpi-critical" : p > 0.6 ? "dpi-high" : p > 0.4 ? "dpi-moderate" : "dpi-low";

  let cards = "";
  for (const dir of directions) {
    const d = demand[dir] || {};
    const pressure = d.pressure_index || 0;
    const pct = Math.min(100, pressure * 100);
    const target = Math.round(d.target_veh_h || 0);
    const cap = Math.round(d.capacity_veh_h || 0);
    const saturation = cap > 0 ? Math.min(1, target / cap) : 0;
    cards += `<div class="dpi-card ${levelClass(pressure)}">
      <div class="dpi-header">
        <span class="dpi-dir">${directionLabel(dir)}</span>
        <span class="dpi-badge">${levelLabel(pressure)}</span>
      </div>
      <div class="dpi-gauge-wrap">
        <div class="dpi-gauge-track">
          <div class="dpi-gauge-fill" style="width:${pct}%"></div>
          <div class="dpi-gauge-markers">
            <div class="dpi-gauge-mark" style="left:40%" title="Moderate threshold"></div>
            <div class="dpi-gauge-mark dpi-gauge-mark--warn" style="left:60%" title="High threshold"></div>
            <div class="dpi-gauge-mark dpi-gauge-mark--danger" style="left:80%" title="Critical threshold"></div>
          </div>
        </div>
        <span class="dpi-pct">${Math.round(pct)}%</span>
      </div>
      <div class="dpi-stats">
        <div><span>الطلب الحالي</span><strong>${target} veh/h</strong></div>
        <div><span>الطاقة الاستيعابية</span><strong>${cap > 0 ? cap + " veh/h" : "—"}</strong></div>
        <div><span>نسبة التشبع</span><strong>${(saturation * 100).toFixed(0)}%</strong></div>
      </div>
    </div>`;
  }

  els.demandPressure.innerHTML = `
    <div class="dpi-explainer">
      <strong>ما هو مؤشر ضغط الطلب؟</strong>
      مؤشر يقيس كم من الطاقة الاستيعابية للمدخل تمتلئ حالياً بالطلب الفعلي.
      0% = خالٍ، 100% = مكتمل التشبع، أكثر من 80% = خطر حدوث ازدحام.
    </div>
    <div class="dpi-grid">${cards}</div>`;
}

function riskLabel(stateName) {
  return {
    stable: "Stable",
    watch: "Watch",
    high_risk: "High risk",
    severe_risk: "Severe risk",
  }[stateName] || stateName || "Unknown";
}

function riskClass(score) {
  if (score >= 0.78) return "risk-severe";
  if (score >= 0.58) return "risk-high";
  if (score >= 0.38) return "risk-watch";
  return "risk-stable";
}

function renderTrafficCounts() {
  if (!els.trafficCountsGrid) return;
  const payload = state.trafficCounts;
  const source = payload.directions;
  const entries = Object.values(source || {});
  if (!entries.length) {
    els.trafficCountsGrid.innerHTML = '<div class="empty-state">No traffic-count rows available</div>';
    return;
  }
  const rows = directions.map((dir) => payload.directions?.[dir]).filter(Boolean);
  els.trafficCountsGrid.innerHTML = rows.map((row) => {
    const title = directionLabel(row.direction);
    const risk = Number(row.risk_score || 0);
    const drivers = (row.drivers || []).slice(0, 2).join(" · ");
    const barColor = risk >= 0.58 ? "var(--danger)" : risk >= 0.38 ? "var(--warning)" : "var(--accent)";
    return `<div class="traffic-count-card ${riskClass(risk)}">
      <div class="traffic-count-head">
        <strong>${title}</strong>
        <span>${riskLabel(row.expected_state_5m)}</span>
      </div>
      <div class="traffic-count-main">
        <div title="Vehicles detected entering in the last minute"><span>${row.entry_count_1m ?? 0}</span><small>Vehicles (1m)</small></div>
        <div title="Vehicles detected entering in the last 5 minutes"><span>${row.entry_count_5m ?? 0}</span><small>Vehicles (5m)</small></div>
        <div title="Vehicles detected entering in the last 15 minutes"><span>${row.entry_count_15m ?? 0}</span><small>Vehicles (15m)</small></div>
      </div>
      <div class="traffic-share-bar" title="Free / slow / jam corridor share">
        <div class="share-free" style="width:${row.free_pct || 0}%"></div>
        <div class="share-slow" style="width:${row.slow_pct || 0}%"></div>
        <div class="share-jam" style="width:${row.jam_pct || 0}%"></div>
      </div>
      <div class="traffic-util-row"><span>Queue utilization</span><strong>${Number(row.queue_utilization_pct || 0).toFixed(0)}%</strong></div>
      <div class="pressure-bar"><div class="pressure-fill" style="width:${Math.min(100, row.queue_utilization_pct || 0)}%;background:${barColor}"></div></div>
      <p>${drivers}</p>
      <small>${row.count_source || row.source_provenance?.counts || "estimated"}</small>
    </div>`;
  }).join("");
}

function renderPeakHours() {
  if (!els.peakHoursGrid) return;
  const payload = state.peakHours;
  if (!payload?.directions) {
    els.peakHoursGrid.innerHTML = '<div class="empty-state">Historical peak-hour analytics not available yet</div>';
    if (els.peakHoursChart) els.peakHoursChart.innerHTML = "";
    return;
  }
  const source = payload.directions || {};
  const keys = directions;

  // ── View mode toggle bar ─────────────────────────────────
  const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const viewMode = state.peakViewMode || "week";
  const selectedDay = state.peakSelectedDay || "Monday";

  const viewToggleHtml = `<div class="peak-view-toggle">
    <button class="peak-view-btn${viewMode === "week" ? " active" : ""}" data-peak-view="week">أيام الأسبوع</button>
    <button class="peak-view-btn${viewMode === "day" ? " active" : ""}" data-peak-view="day">ساعات اليوم</button>
    ${viewMode === "day" ? `<div class="peak-day-pills">${WEEKDAYS.map(d =>
      `<button class="peak-day-pill${d === selectedDay ? " active" : ""}" data-peak-day="${d}">${d.slice(0, 3)}</button>`
    ).join("")}</div>` : ""}
  </div>`;

  // Build a 2-column grid of per-direction bar charts
  let cardsHtml = "";
  for (const key of keys.slice(0, 4)) {
    const data = source[key] || {};
    const entries = Array.isArray(data) ? data : data.top_hours || [];
    const title = directionLabel(key);

    let mainContent = "";
    if (viewMode === "week") {
      const byDay = {};
      for (const item of entries) {
        const d = item.weekday;
        if (!byDay[d] || item.mean_veh_h > byDay[d]) byDay[d] = item.mean_veh_h;
      }
      const maxVal = Math.max(1, ...Object.values(byDay));
      
      const activeDays = Object.keys(byDay).filter(d => byDay[d] > 0).sort((a, b) => byDay[b] - byDay[a]);
      const topDayText = activeDays.length > 0 ? `<div style="margin-bottom:12px;display:flex;gap:12px;"><div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);flex:1;"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Top Peak Day</div><div style="font-size:18px;font-weight:700;color:var(--danger);margin-top:4px;">${activeDays[0]}</div><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${Math.round(byDay[activeDays[0]])} veh/h</div></div></div>` : "";

      const maxValStr = maxVal > 1 ? Math.round(maxVal) : 0;
      const q3ValStr = maxVal > 1 ? Math.round(maxVal * 0.75) : 0;
      const midValStr = maxVal > 1 ? Math.round(maxVal * 0.5) : 0;
      const q1ValStr = maxVal > 1 ? Math.round(maxVal * 0.25) : 0;

      mainContent = topDayText + `
      <div style="position:relative; height:220px; display:flex; padding-top:16px; margin-top:8px; border-top:1px solid var(--border);">
        <!-- Y Axis -->
        <div style="position:absolute; left:0; top:16px; bottom:20px; width:45px; display:flex; flex-direction:column; justify-content:space-between; font-size:10px; color:var(--text-muted); text-align:right; padding-right:8px; border-right:1px solid var(--border);">
          <span>${maxValStr}</span>
          <span>${q3ValStr}</span>
          <span>${midValStr}</span>
          <span>${q1ValStr}</span>
          <span>0</span>
        </div>
        <!-- Grid lines -->
        <div style="position:absolute; left:45px; right:0; top:16px; height:1px; background:var(--border); opacity:0.2;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(25% + 12px); height:1px; background:var(--border); opacity:0.1;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(50% + 8px); height:1px; background:var(--border); opacity:0.2;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(75% + 4px); height:1px; background:var(--border); opacity:0.1;"></div>
        <div style="position:absolute; left:45px; right:0; bottom:20px; height:1px; background:var(--border); opacity:0.4;"></div>
        
        <!-- Bars -->
        <div style="flex:1; margin-left:45px; display:flex; gap:12px; align-items:flex-end; padding-bottom:20px; position:relative;">
          ${WEEKDAYS.map(d => {
            const v = Math.round(byDay[d] || 0);
            const pct = v > 0 ? Math.max(3, (v / maxVal) * 100) : 0;
            const barBg = v > maxVal * 0.8 ? "linear-gradient(to top, var(--danger), #ff6b6b)" : "linear-gradient(to top, var(--accent), #4facfe)";
            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; position:relative;" title="${d}: ${v} veh/h">
              <div style="width:100%; height:100%; display:flex; align-items:flex-end; justify-content:center; overflow:visible;">
                <div style="width:100%; background:${barBg}; height:${pct}%; opacity:${v>0?1:0.1}; transition:height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border-radius:6px 6px 0 0; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);"></div>
              </div>
              <span style="font-size:10px; font-weight:600; color:var(--text-muted); position:absolute; bottom:-18px;">${d.slice(0, 3)}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;

    } else {
      const byHour = {};
      for (const item of entries) {
        if (item.weekday === selectedDay) byHour[item.hour] = item.mean_veh_h;
      }
      const maxVal = Math.max(1, ...Object.values(byHour).filter(Boolean));
      
      const activeHours = Object.keys(byHour).map(Number).filter(h => byHour[h] > 0).sort((a, b) => byHour[b] - byHour[a]);
      const topHours = activeHours.slice(0, 3);
      
      let topHoursHtml = topHours.length > 0 ? topHours.map((h, i) => {
        const isRush = (h >= 7 && h <= 9) || (h >= 16 && h <= 19);
        const color = isRush ? 'var(--danger)' : 'var(--warning)';
        return `<div style="background:var(--bg-surface);padding:12px;border-radius:8px;border:1px solid var(--border);flex:1;">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Peak #${i+1}</div>
          <div style="font-size:20px;font-weight:700;color:${color};margin-top:4px;">${String(h).padStart(2,"0")}:00</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px;font-weight:500;">${Math.round(byHour[h])} <span style="font-size:11px;font-weight:400">veh/h</span></div>
        </div>`;
      }).join("") : `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">No active traffic data available for ${selectedDay}.</div>`;

      const maxValStr = maxVal > 1 ? Math.round(maxVal) : 0;
      const q3ValStr = maxVal > 1 ? Math.round(maxVal * 0.75) : 0;
      const midValStr = maxVal > 1 ? Math.round(maxVal * 0.5) : 0;
      const q1ValStr = maxVal > 1 ? Math.round(maxVal * 0.25) : 0;

      mainContent = `<div style="display:flex;gap:12px;margin-bottom:16px;">${topHoursHtml}</div>
      <div style="position:relative; height:200px; display:flex; padding-top:16px; border-top:1px solid var(--border);">
        <!-- Y Axis -->
        <div style="position:absolute; left:0; top:16px; bottom:20px; width:45px; display:flex; flex-direction:column; justify-content:space-between; font-size:10px; color:var(--text-muted); text-align:right; padding-right:8px; border-right:1px solid var(--border);">
          <span>${maxValStr}</span>
          <span>${q3ValStr}</span>
          <span>${midValStr}</span>
          <span>${q1ValStr}</span>
          <span>0</span>
        </div>
        <!-- Grid lines -->
        <div style="position:absolute; left:45px; right:0; top:16px; height:1px; background:var(--border); opacity:0.2;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(25% + 12px); height:1px; background:var(--border); opacity:0.1;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(50% + 8px); height:1px; background:var(--border); opacity:0.2;"></div>
        <div style="position:absolute; left:45px; right:0; top:calc(75% + 4px); height:1px; background:var(--border); opacity:0.1;"></div>
        <div style="position:absolute; left:45px; right:0; bottom:20px; height:1px; background:var(--border); opacity:0.4;"></div>
        
        <!-- Bars -->
        <div style="flex:1; margin-left:40px; display:flex; gap:2px; align-items:flex-end; padding-bottom:20px; position:relative;">
          ${Array.from({ length: 24 }, (_, h) => {
            const v = Math.round(byHour[h] || 0);
            const pct = v > 0 ? Math.max(2, (v / maxVal) * 100) : 0;
            const isRush = (h >= 7 && h <= 9) || (h >= 16 && h <= 19);
            const color = isRush ? "var(--warning)" : "var(--accent)";
            return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; height:100%; position:relative;" title="${String(h).padStart(2,"0")}:00 - ${v} veh/h">
              <div style="width:100%; height:100%; display:flex; align-items:flex-end; justify-content:center;">
                <div style="width:100%; background:${color}; height:${pct}%; opacity:${v>0?1:0.15}; transition:height 0.3s ease; border-radius:2px 2px 0 0;"></div>
              </div>
            </div>`;
          }).join("")}
          <div style="position:absolute; left:0; right:0; bottom:-18px; display:flex; justify-content:space-between; font-size:10px; color:var(--text-muted); font-weight:500;">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
          </div>
        </div>
      </div>`;
    }

    cardsHtml += `<div class="phb-card" style="display:flex;flex-direction:column;justify-content:space-between;padding:20px;">
      <div class="phb-title" style="font-size:13px;letter-spacing:1px;font-weight:600;color:var(--text-muted);margin-bottom:16px;">${title}</div>
      <div>${mainContent}</div>
    </div>`;
  }

  if (els.peakHoursChart) els.peakHoursChart.innerHTML = viewToggleHtml + `<div class="phb-grid">${cardsHtml}</div>`;
  els.peakHoursGrid.innerHTML = "";

  // Bind toggle buttons
  els.peakHoursChart?.querySelectorAll("[data-peak-view]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.peakViewMode = btn.dataset.peakView;
      renderPeakHours();
    });
  });
  els.peakHoursChart?.querySelectorAll("[data-peak-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.peakSelectedDay = btn.dataset.peakDay;
      renderPeakHours();
    });
  });
}

function heatColor(value, maxValue) {
  if (value == null || maxValue <= 0) return "rgba(148, 163, 184, 0.10)";
  const ratio = Math.max(0, Math.min(1, value / maxValue));
  if (ratio >= 0.85) return "rgba(239, 68, 68, 0.92)";
  if (ratio >= 0.60) return "rgba(245, 158, 11, 0.86)";
  if (ratio >= 0.35) return "rgba(34, 197, 94, 0.76)";
  return "rgba(59, 130, 246, 0.52)";
}

function renderVolumeHeatmap() {
  if (!els.volumeHeatmap) return;
  const payload = state.volumeHeatmap;
  if (!payload?.directions) {
    els.volumeHeatmap.innerHTML = '<div class="empty-state">Historical heat-map analytics not available yet</div>';
    return;
  }
  const weekdays = payload.weekdays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const hours = payload.hours || [...Array(24).keys()];
  let html = "";
  for (const dir of directions) {
    const data = payload.directions[dir] || {};
    const heatmap = data.heatmap || [];
    const maxValue = data.heatmap_max || 1;
    let header = '<div class="heatmap-corner"></div>';
    for (const hour of hours) {
      header += `<div class="heatmap-hour">${String(hour).padStart(2, "0")}</div>`;
    }
    let cells = header;
    weekdays.forEach((day, dayIdx) => {
      cells += `<div class="heatmap-day">${day.slice(0, 3)}</div>`;
      for (let hourIdx = 0; hourIdx < hours.length; hourIdx += 1) {
        const value = heatmap?.[dayIdx]?.[hourIdx];
        const title = value == null ? `${day} ${String(hourIdx).padStart(2, "0")}:00 — no data`
          : `${day} ${String(hourIdx).padStart(2, "0")}:00 — ${Math.round(value)} veh/h`;
        cells += `<div class="heatmap-cell" title="${title}" style="background:${heatColor(value, maxValue)}">${value == null ? "·" : Math.round(value)}</div>`;
      }
    });
    html += `<div class="heatmap-card">
      <div class="heatmap-title">${directionLabel(dir)}<span>Peak observed mean ${Math.round(maxValue)} veh/h</span></div>
      <div class="heatmap-grid">${cells}</div>
    </div>`;
  }
  els.volumeHeatmap.innerHTML = html;
}

// ── Analytics Tab: Lane occupancy ────────────────────────────
function renderLaneOccupancy(live) {
  if (!els.laneOccupancy) return;
  const lm = live.lane_metrics || {};
  const entries = Object.entries(lm).filter(([, v]) => v.occupancy_pct != null).sort((a, b) => b[1].occupancy_pct - a[1].occupancy_pct);
  if (!entries.length) { els.laneOccupancy.innerHTML = '<div class="empty-state">No lane data yet</div>'; return; }
  let html = "";
  for (const [id, m] of entries.slice(0, 16)) {
    const pct = m.occupancy_pct || 0;
    const color = pct > 60 ? "var(--danger)" : pct > 30 ? "var(--warning)" : "var(--accent)";
    const label = `${directionLabel(m.direction)} - مسرب ${parseInt(id.split('_').pop()) + 1}`;
    html += `<div class="occ-row">
      <span class="occ-label" title="${id}">${label}</span>
      <div class="occ-bar"><div class="occ-fill" style="width:${pct}%;background:${color}"></div></div>
      <span class="occ-val">${pct.toFixed(0)}%</span>
    </div>`;
  }
  els.laneOccupancy.innerHTML = html;
}

// ── Analytics Tab: Model accuracy ────────────────────────────
function renderModelAccuracyPanel() {
  if (!els.modelAccuracy || !state.modelEvaluation) return;
  const eval_ = state.modelEvaluation;
  if (!eval_.forecasting) return;
  let html = "";
  for (const [dir, data] of Object.entries(eval_.forecasting)) {
    const mae = data.mae_veh_h || 0;
    const rmse = data.rmse_veh_h || 0;
    html += `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:var(--text-sm);margin-bottom:3px;">
        <span>${directionLabel(dir)}</span>
        <span class="font-mono text-muted" style="font-size:var(--text-xs)">MAE ${mae.toFixed(0)} · RMSE ${rmse.toFixed(0)}</span>
      </div>
      <div class="pressure-bar"><div class="pressure-fill" style="width:${Math.min(100, mae / 2)}%;background:var(--info)"></div></div>
    </div>`;
  }
  els.modelAccuracy.innerHTML = html || '<div class="empty-state">No evaluation data</div>';
}

// ── System Tab ───────────────────────────────────────────────
function renderSystemTab(live) {
  const connEl = document.getElementById("sys-connection-info");
  if (connEl) {
    const sourceLabel = live.source === "google_routes" ? "Google Routes (Live)"
      : live.source === "google_routes_stale" ? "Google Routes (Stale)"
      : live.source === "mock" ? "Mock Data" : live.source || "Unknown";
    connEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Status</span><span class="badge ${state.connectionStatus === 'connected' ? 'badge-live' : 'badge-warn'}">${state.connectionStatus}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Source</span><span>${sourceLabel}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Vehicles</span><span>${live.vehicles?.length || 0}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Sim Time</span><span class="font-mono">${live.sim_time_s ? live.sim_time_s.toFixed(0) + 's' : '--'}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Last Update</span><span class="font-mono">${formatTime(live.wall_time)}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Adaptive</span><span class="badge ${live.adaptive_active ? 'badge-live' : 'badge-muted'}">${live.adaptive_active ? 'ON' : 'OFF'}</span></div>
      </div>`;
  }
  const dsEl = document.getElementById("sys-data-source");
  if (dsEl) {
    dsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Primary</span><span>${live.source || '--'}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Google Error</span><span style="font-size:var(--text-xs);max-width:200px;text-align:right">${live.google_error || 'None'}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">Center</span><span class="font-mono">${live.simulation_center ? live.simulation_center.lat.toFixed(4) + ', ' + live.simulation_center.lon.toFixed(4) : '--'}</span></div>
        <div style="display:flex;justify-content:space-between;"><span class="text-muted">TLS ID</span><span class="font-mono">${live.controller_tls_id || '--'}</span></div>
      </div>`;
  }
}

async function runSimulationScenario() {
  if (!els.simRun) return;
  const engine = getSelectedSimulationEngine();
  const payload = readSimulationPayloadFromUi(engine);
  simulationPollToken += 1;
  const token = simulationPollToken;
  stopSimulationAnimation();
  simAnim.snapIdx = 0;
  els.simRun.disabled = true;
  if (els.simulationStatus) {
    els.simulationStatus.textContent = "Queued";
    els.simulationStatus.className = "badge badge-warn";
  }
  renderSimulationPending(engine, payload);
  try {
    const res = await fetch("/api/simulation/what-if", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const job = await res.json();
    if (!res.ok || job.status === "failed") {
      throw new Error(job.error || `HTTP ${res.status}`);
    }
    state.simulationJob = job;
    if (job.status === "completed") {
      renderSimulationLab();
    } else {
      if (els.simulationStatus) {
        els.simulationStatus.textContent = "Running";
        els.simulationStatus.className = "badge badge-warn";
      }
      await pollSimulationJob(job.job_id, token);
    }
  } catch (err) {
    if (els.simulationSummary) els.simulationSummary.innerHTML = `<div class="empty-state">Scenario failed: ${err.message}</div>`;
    if (els.simulationStatus) {
      els.simulationStatus.textContent = "Failed";
      els.simulationStatus.className = "badge badge-warn";
    }
  } finally {
    els.simRun.disabled = false;
  }
}

// ── Simulation animation state ────────────────────────────────
const simAnim = { rafId: null, snapIdx: 0, mode: "candidate", playing: false, lastTick: 0, speed: 1 };

function renderSimulationLab() {
  const job = state.simulationJob;
  if (!job?.result) return;
  if (els.simulationStatus) {
    els.simulationStatus.textContent = "Completed";
    els.simulationStatus.className = "badge badge-live";
  }
  const { baseline, candidate, comparison } = job.result;

  // Stats summary
  if (els.simulationSummary) {
    const better = comparison.avg_delay_delta_s <= 0;
    const losColor = (l) => ({A:"#22c55e",B:"#4ade80",C:"#facc15",D:"#f97316",E:"#ef4444",F:"#dc2626"}[l]||"#888");
    const fmtDelta = (v,unit,inv) => {const cls=(v<=0)==(!inv)?"good":"bad"; return `<small class="${cls}">${v>=0?"+":""}${v}${unit}</small>`;};
    const engineRequested = candidate.engine_requested || job.result.request?.engine || "math";
    const engineUsed = candidate.engine_used || "math";
    const requestedLabel = SIM_ENGINE_OPTIONS[engineRequested]?.label || engineRequested;
    const usedLabel = SIM_ENGINE_OPTIONS[engineUsed]?.label || engineUsed;
    const engineNotice = candidate.engine_fallback_reason
      ? `<div class="sim-safety-warn medium">SUMO could not complete, so the scenario safely fell back to the fast HCM model. Reason: ${candidate.engine_fallback_reason}</div>`
      : "";
    const engineMeta = engineRequested === engineUsed
      ? `Engine: ${usedLabel}`
      : `Requested: ${requestedLabel} · Used: ${usedLabel}`;

    // Safety warnings
    const warnings = (candidate.safety_warnings || []).map(w =>
      `<div class="sim-safety-warn ${w.severity.toLowerCase()}">${w.message}</div>`
    ).join("");

    // Per-direction comparison table
    const dirComp = comparison.direction_comparison || {};
    const dirLabels = {northbound:"شمال ↑",southbound:"جنوب ↓",eastbound:"شرق →",westbound:"غرب ←"};
    let dirRows = "";
    for (const [d, label] of Object.entries(dirLabels)) {
      const b = baseline.direction_breakdown?.[d] || {};
      const c = candidate.direction_breakdown?.[d] || {};
      const dc = dirComp[d] || {};
      dirRows += `<tr>
        <td style="font-weight:600">${label}</td>
        <td><span style="color:${losColor(b.los)}">${b.los||"?"}</span> → <span style="color:${losColor(c.los)};font-weight:700">${c.los||"?"}</span></td>
        <td class="font-mono">${b.avg_delay_s||0}s → ${c.avg_delay_s||0}s ${fmtDelta(dc.delay_delta_s||0,"s",false)}</td>
        <td class="font-mono">${(b.v_over_c||0).toFixed(2)} → ${(c.v_over_c||0).toFixed(2)}</td>
        <td class="font-mono">${b.avg_queue_m||0}m → ${c.avg_queue_m||0}m</td>
      </tr>`;
    }

    const sources = new Set(Object.values(candidate.direction_breakdown || {}).map(d => d.source_name || "Unknown"));
    const sourcesList = Array.from(sources).join(" & ");
    const sourceBadgeColor = sourcesList.includes("Google Maps") ? "var(--accent)" : sourcesList.includes("YOLO") ? "var(--warning)" : "var(--text-muted)";

    els.simulationSummary.innerHTML = `
      ${warnings || engineNotice ? `<div class="sim-safety-box">${engineNotice}${warnings}</div>` : ""}
      <div style="margin-bottom:16px;padding:8px 12px;border-radius:6px;background:var(--bg-glass);border:1px solid var(--border);font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${sourceBadgeColor};box-shadow:0 0 8px ${sourceBadgeColor}"></span>
        <span style="letter-spacing:0.5px;text-transform:uppercase;">Live Data Engine:</span>
        <strong style="color:var(--text-main);font-size:12px;">${sourcesList}</strong>
      </div>
      <div style="margin-bottom:12px;padding:10px 12px;border-radius:6px;background:var(--primary-subtle);border:1px solid rgba(99,102,241,.18);font-size:12px;color:var(--text-secondary);">
        <strong style="display:block;color:var(--text-primary);margin-bottom:4px;">Simulation Engine</strong>
        ${engineMeta}
      </div>
      <div class="simulation-result-grid">
        <div><span>مستوى الخدمة</span><strong style="color:${losColor(candidate.intersection_los||"?")};font-size:1.5rem">${candidate.intersection_los||"?"}</strong><small>LOS (HCM 2010)</small></div>
        <div><span>تأخير متوسط</span><strong>${candidate.avg_delay_s}s</strong>${fmtDelta(comparison.avg_delay_delta_s,"s",false)} <small>per vehicle</small></div>
        <div><span>دورة الإشارة</span><strong>${candidate.cycle_s||"?"}s</strong><small>baseline: ${baseline.cycle_s||"?"}s</small></div>
        <div><span>انسدادات</span><strong>${candidate.spillback_events.length}</strong>${fmtDelta(comparison.spillback_delta,"",false)}</div>
      </div>
      <table class="sim-dir-table">
        <thead><tr><th>اتجاه</th><th>LOS</th><th>تأخير (s/veh)</th><th>v/c</th><th>طابور</th></tr></thead>
        <tbody>${dirRows}</tbody>
      </table>
      <div class="sim-anim-controls">
        <button id="sim-play-pause" class="btn btn-ghost sim-play-btn">${simAnim.playing ? "⏸ Pause" : "▶ Play"}</button>
        <select id="sim-speed" class="sim-speed-select">
          <option value="1">1×</option>
          <option value="2">2×</option>
          <option value="4">4×</option>
        </select>
        <span class="sim-anim-legend">
          <span style="color:#aaa">━━</span> Proposed plan &nbsp;
          <span style="color:#666">╌╌</span> Current live plan
        </span>
      </div>
      <div class="sim-timeline-wrap">
        <input id="sim-timeline" type="range" class="sim-timeline" min="0"
          max="${Math.max((job.result.baseline?.vehicle_snapshots?.length || 1), (job.result.candidate?.vehicle_snapshots?.length || 1)) - 1}"
          value="${simAnim.snapIdx}" step="1">
        <span id="sim-timeline-label" class="sim-timeline-label">t=${(job.result.baseline?.vehicle_snapshots?.[simAnim.snapIdx]?.t ?? 0)}s</span>
      </div>`;

    // Bind controls
    document.getElementById("sim-play-pause")?.addEventListener("click", () => {
      simAnim.playing ? stopSimulationAnimation() : startSimulationAnimation();
      renderSimulationLab();
    });
    document.getElementById("sim-speed")?.addEventListener("change", (e) => {
      simAnim.speed = Number(e.target.value) || 1;
    });
    document.getElementById("sim-timeline")?.addEventListener("input", (e) => {
      simAnim.snapIdx = Number(e.target.value);
      drawIntersectionFrame();
      const snap = job.result[simAnim.mode]?.vehicle_snapshots?.[simAnim.snapIdx];
      if (snap) {
        const lbl = document.getElementById("sim-timeline-label");
        if (lbl) lbl.textContent = `t=${snap.t}s`;
      }
    });
  }

  drawIntersectionFrame();
}

function startSimulationAnimation() {
  simAnim.playing = true;
  simAnim.lastTick = performance.now();
  function tick(now) {
    if (!simAnim.playing) return;
    const job = state.simulationJob;
    const baseSnaps = job?.result?.baseline?.vehicle_snapshots || [];
    const candSnaps = job?.result?.candidate?.vehicle_snapshots || [];
    const total = Math.max(baseSnaps.length, candSnaps.length);
    if (!total) return;
    const msBetweenFrames = 800 / simAnim.speed;
    if (now - simAnim.lastTick >= msBetweenFrames) {
      simAnim.lastTick = now;
      simAnim.snapIdx = (simAnim.snapIdx + 1) % total;
      drawIntersectionFrame();
      const tl = document.getElementById("sim-timeline");
      const lbl = document.getElementById("sim-timeline-label");
      const snap = (baseSnaps[simAnim.snapIdx] || candSnaps[simAnim.snapIdx]);
      if (tl) { tl.value = simAnim.snapIdx; tl.max = total - 1; }
      if (lbl) lbl.textContent = `t=${snap?.t ?? 0}s`;
    }
    simAnim.rafId = requestAnimationFrame(tick);
  }
  simAnim.rafId = requestAnimationFrame(tick);
}

function stopSimulationAnimation() {
  simAnim.playing = false;
  if (simAnim.rafId) { cancelAnimationFrame(simAnim.rafId); simAnim.rafId = null; }
}

function drawIntersectionFrame() {
  const canvas = els.simulationCanvas;
  if (!canvas) return;
  const job = state.simulationJob;
  if (!job?.result) return;
  const baseSnaps = job.result.baseline?.vehicle_snapshots || [];
  const candSnaps = job.result.candidate?.vehicle_snapshots || [];
  if (!baseSnaps.length && !candSnaps.length) return;
  const idx = Math.min(simAnim.snapIdx, Math.max(baseSnaps.length, candSnaps.length) - 1);
  const baseSnap = baseSnaps[Math.min(idx, baseSnaps.length - 1)] || null;
  const candSnap = candSnaps[Math.min(idx, candSnaps.length - 1)] || null;
  drawSplitIntersection(canvas, baseSnap, candSnap, job.result.request);
  drawQueueChart();
}

// ── Split-screen intersection (current live plan left | proposed plan right) ──
function drawSplitIntersection(canvas, baseSnap, candSnap, request) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const D = Math.floor(W / 2);          // divider x position

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = isDark ? "#0b1620" : "#e6edf5";
  ctx.fillRect(0, 0, W, H);

  // Draw both halves
  _drawHalf(ctx, baseSnap, request?.baseline_greens, 0, 0, D, H, "Current Live Plan (الحالي)", isDark);
  _drawHalf(ctx, candSnap, request?.candidate_greens, D, 0, W - D, H, "Proposed Plan ✦ (المقترح)", isDark);

  // Center divider
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.10)";
  ctx.fillRect(D - 1, 0, 2, H);
}

function _drawHalf(ctx, snap, greens, ox, oy, W, H, label, isDark) {
  const PAL = {
    road:  isDark ? "#121a24" : "#cbd5e1", // Asphalt base
    mark:  isDark ? "#2e4460" : "#94a3b8", // Lane markings
    box:   isDark ? "#0f1e2b" : "#f0f5fa",
    text:  isDark ? "rgba(240,250,255,.8)" : "rgba(10,22,40,.75)",
    NB:"#42d8c5", SB:"#ffb038", EB:"#ffe03a", WB:"#6ab8ff",
    green:"#22c55e", yellow:"#eab308", red:"#ef4444",
  };

  const cx = ox + W / 2, cy = oy + H / 2;
  const RW = 54, HALF = RW / 2;
  const ARM_N = cy - oy - HALF - 8;
  const ARM_S = oy + H - cy - HALF - 8;
  const ARM_W = cx - ox - HALF - 8;
  const ARM_E = ox + W - cx - HALF - 8;

  // ── Roads ───────────────────────────────────────────────────
  ctx.fillStyle = PAL.road;
  ctx.fillRect(cx - HALF, oy,        RW, ARM_N);                   // N arm
  ctx.fillRect(cx - HALF, cy + HALF, RW, ARM_S);                   // S arm
  ctx.fillRect(ox,        cy - HALF, ARM_W, RW);                   // W arm
  ctx.fillRect(cx + HALF, cy - HALF, ARM_E, RW);                   // E arm
  ctx.fillRect(cx - HALF, cy - HALF, RW, RW);                      // box

  // Crosswalk zebra stripes
  const STRIP_W = 6, STRIP_H = 8, STRIPS = 4;
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.55)";
  for (let i = 0; i < STRIPS; i++) {
    const off = (i / STRIPS) * RW + 4;
    ctx.fillRect(cx - HALF + off, cy + HALF - STRIP_H - 2, STRIP_W, STRIP_H); // NB side
    ctx.fillRect(cx - HALF + off, cy - HALF + 2, STRIP_W, STRIP_H);           // SB side
    ctx.fillRect(cx - HALF - STRIP_H - 2, cy - HALF + off, STRIP_H, STRIP_W); // EB side
    ctx.fillRect(cx + HALF + 2, cy - HALF + off, STRIP_H, STRIP_W);           // WB side
  }

  // Center dashes
  ctx.strokeStyle = PAL.mark;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 7]);
  [[cx, oy + 2,       cx, cy - HALF - 2],
   [cx, cy + HALF + 2, cx, oy + H - 2],
   [ox + 2, cy,       cx - HALF - 2, cy],
   [cx + HALF + 2, cy, ox + W - 2, cy]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Stop lines
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + HALF); ctx.lineTo(cx + HALF, cy + HALF);   // NB
  ctx.moveTo(cx - HALF, cy - HALF); ctx.lineTo(cx, cy - HALF);   // SB
  ctx.moveTo(cx - HALF, cy); ctx.lineTo(cx - HALF, cy + HALF);   // EB
  ctx.moveTo(cx + HALF, cy - HALF); ctx.lineTo(cx + HALF, cy);   // WB
  ctx.stroke();

  // ── Signal phase ─────────────────────────────────────────────
  const ph = snap?.phase || "";
  const sig = {
    NB: ph === "ns_green" ? "green" : ph === "clearance" ? "yellow" : "red",
    SB: ph === "ns_green" ? "green" : ph === "clearance" ? "yellow" : "red",
    EB: ph === "e_green"  ? "green" : ph === "clearance" ? "yellow" : "red",
    WB: ph === "w_green"  ? "green" : ph === "clearance" ? "yellow" : "red",
  };
  const sigC = (s) => s === "green" ? PAL.green : s === "yellow" ? PAL.yellow : PAL.red;
  _drawSignalBox(ctx, cx + HALF + 4, cy + HALF + 4, sig.NB, sigC, isDark);
  _drawSignalBox(ctx, cx - HALF - 20, cy - HALF - 4, sig.SB, sigC, isDark);
  _drawSignalBox(ctx, cx - HALF - 4, cy + HALF + 4, sig.EB, sigC, isDark);
  _drawSignalBox(ctx, cx + HALF + 4, cy - HALF - 4, sig.WB, sigC, isDark);

  // ── Queue visualization (filled road arm + car rects) ─────────
  const dirs = snap?.directions || {};
  const MAX_Q_M = 120;  // max visible queue length in meters
  _drawQueueArm(ctx, dirs.northbound, PAL.NB, sig.NB === "green",
    cx + 2, cy + HALF + 2, HALF - 4, ARM_S - 2, "down", MAX_Q_M);
  _drawQueueArm(ctx, dirs.southbound, PAL.SB, sig.SB === "green",
    cx - HALF + 2, cy - HALF - ARM_N, HALF - 4, ARM_N - 2, "up", MAX_Q_M);
  _drawQueueArm(ctx, dirs.eastbound, PAL.EB, sig.EB === "green",
    cx - HALF - ARM_W, cy + 2, ARM_W - 2, HALF - 4, "right", MAX_Q_M);
  _drawQueueArm(ctx, dirs.westbound, PAL.WB, sig.WB === "green",
    cx + HALF + 2, cy - HALF + 2, ARM_E - 2, HALF - 4, "left", MAX_Q_M);

  // ── Labels (Direction Badges) ─────────────────────────
  const drawBadge = (label, qM, bx, by, color, arrow) => {
    const bW = 60, bH = 34;
    ctx.save();
    ctx.fillStyle = isDark ? 'rgba(10,14,26,0.85)' : 'rgba(240,245,250,0.85)';
    ctx.strokeStyle = color + '66';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - bW/2, by - bH/2, bW, bH, 6);
    else ctx.fillRect(bx - bW/2, by - bH/2, bW, bH);
    ctx.fill(); ctx.stroke();
    
    ctx.fillStyle = color;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(bx - bW/2, by - bH/2, bW, 2, [6,6,0,0]); ctx.fill(); }
    
    ctx.font = "bold 10px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`${arrow} ${label}`, bx, by - bH/2 + 14);
    
    ctx.fillStyle = isDark ? '#f1f5f9' : '#1e293b';
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    ctx.fillText(`${Math.round(qM)}m queue`, bx, by + 10);
    ctx.restore();
  };

  drawBadge("North", dirs.northbound?.queue_m || 0, cx + HALF/2 + 34, oy + H - 24, PAL.NB, "↑");
  drawBadge("South", dirs.southbound?.queue_m || 0, cx - HALF/2 - 34, oy + 24, PAL.SB, "↓");
  drawBadge("West", dirs.westbound?.queue_m || 0, ox + W - 38, cy - HALF/2 - 24, PAL.WB, "←");
  drawBadge("East", dirs.eastbound?.queue_m || 0, ox + 38, cy + HALF/2 + 24, PAL.EB, "→");

  // ── Header label ─────────────────────────────────────────────
  ctx.textAlign = "center";
  const isCandidate = label.includes("✦");
  ctx.fillStyle = isCandidate
    ? (isDark ? "rgba(99,202,241,.9)" : "rgba(30,100,200,.85)")
    : (isDark ? "rgba(200,220,240,.65)" : "rgba(30,60,90,.55)");
  ctx.font = `bold 11px Menlo, monospace`;
  ctx.fillText(label, cx, oy + 13);

  // Green times
  if (greens) {
    ctx.font = "9px Menlo, monospace";
    ctx.fillStyle = isDark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
    ctx.fillText(`NS:${Math.round(greens.ns_green)}s  E:${Math.round(greens.e_green)}s  W:${Math.round(greens.w_green)}s`, cx, oy + H - 4);
  }

  // Phase indicator strip at top
  const phaseColor = ph === "ns_green" ? PAL.NB : ph === "e_green" ? PAL.EB : ph === "w_green" ? PAL.WB : PAL.mark;
  ctx.fillStyle = phaseColor + "55";
  ctx.fillRect(ox, oy + 18, W, 3);
  ctx.fillStyle = phaseColor;
  ctx.fillRect(ox, oy + 18, W, 2);
}

function _drawSignalBox(ctx, x, y, state, sigC, isDark) {
  ctx.fillStyle = isDark ? "#1a2535" : "#2a3545";
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - 5, y - 5, 10, 26, 3); ctx.fill(); }
  else { ctx.fillRect(x - 5, y - 5, 10, 26); }
  ["red", "yellow", "green"].forEach((col, i) => {
    const on = (col === state);
    ctx.beginPath();
    ctx.arc(x, y + i * 8, on ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = on ? sigC(col) : (isDark ? "#1e2d3e" : "#3a4a5e");
    if (on) { ctx.shadowColor = sigC(col); ctx.shadowBlur = 10; }
    ctx.fill();
    ctx.shadowBlur = 0;
  });
}

function _drawQueueArm(ctx, dirData, color, isGreen, ax, ay, aw, ah, dir, maxM) {
  const qM = dirData?.queue_m || 0;
  if (!qM) return;
  const ratio = Math.min(1, qM / maxM);
  let fx, fy, fw, fh;
  if (dir === "down")  { fw = aw; fh = Math.max(2, Math.round(ah * ratio)); fx = ax; fy = ay; }
  if (dir === "up")    { fw = aw; fh = Math.max(2, Math.round(ah * ratio)); fx = ax; fy = ay + ah - fh; }
  if (dir === "right") { fw = Math.max(2, Math.round(aw * ratio)); fh = ah; fx = ax + aw - fw; fy = ay; }
  if (dir === "left")  { fw = Math.max(2, Math.round(aw * ratio)); fh = ah; fx = ax; fy = ay; }

  // Background fill
  ctx.fillStyle = isGreen ? color + "30" : color + "50";
  ctx.fillRect(fx, fy, fw, fh);

  // Individual car rectangles
  const CL = 14, CW = Math.min(aw, ah) - 4, GAP = 3;
  
  const drawCar = (cx, cy, heading, isBraking, vehIdx) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading * Math.PI / 180);
    
    // Body color based on index to give variety, or fallback to the queue color
    const colors = ["#ffffff", "#aaaaaa", "#333333", "#dd3333", "#3355aa", "#228833", "#aa8822"];
    const bodyColor = colors[vehIdx % colors.length];
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-CW/2 + 1, -CL/2 + 1, CW, CL, 2); ctx.fill(); }
    else ctx.fillRect(-CW/2 + 1, -CL/2 + 1, CW, CL);
    
    // Body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-CW/2, -CL/2, CW, CL, 2); ctx.fill(); ctx.stroke(); }
    else { ctx.fillRect(-CW/2, -CL/2, CW, CL); ctx.strokeRect(-CW/2, -CL/2, CW, CL); }
    
    // Windshield
    ctx.fillStyle = 'rgba(120,180,220,0.7)';
    const wsH = CL * 0.25;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-CW/2 + 1.5, -CL/2 + CL*0.15, CW - 3, wsH, 1); ctx.fill(); }
    else ctx.fillRect(-CW/2 + 1.5, -CL/2 + CL*0.15, CW - 3, wsH);
    
    // Rear window
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(-CW/2 + 2, CL/2 - CL*0.2 - 1, CW - 4, CL*0.2, 1); ctx.fill(); }
    else ctx.fillRect(-CW/2 + 2, CL/2 - CL*0.2 - 1, CW - 4, CL*0.2);
    
    // Brake lights
    if (isBraking) {
      ctx.fillStyle = '#ff2222';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 6;
      ctx.fillRect(-CW/2 + 1, CL/2 - 2, CW*0.25, 2);
      ctx.fillRect(CW/2 - CW*0.25 - 1, CL/2 - 2, CW*0.25, 2);
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  };

  let vehIdx = 0;
  if (dir === "down" || dir === "up") {
    let startY = dir === "down" ? fy : fy + fh - CL;
    const step = dir === "down" ? CL + GAP : -(CL + GAP);
    const heading = dir === "down" ? 180 : 0;
    while (dir === "down" ? startY < fy + fh : startY > fy) {
      drawCar(fx + aw/2, startY + CL/2, heading, !isGreen, vehIdx++);
      startY += step;
    }
  } else {
    let startX = dir === "right" ? fx + fw - CL : fx;
    const step = dir === "right" ? -(CL + GAP) : CL + GAP;
    const heading = dir === "right" ? 90 : 270;
    while (dir === "right" ? startX > fx : startX < fx + fw) {
      drawCar(startX + CL/2, fy + ah/2, heading, !isGreen, vehIdx++);
      startX += step;
    }
  }
}

// ── Queue evolution chart (below intersection) ───────────────
function drawQueueChart() {
  const chartEl = document.getElementById("sim-queue-chart");
  if (!chartEl) return;
  const job = state.simulationJob;
  if (!job?.result) return;
  const baseSnaps = job.result.baseline?.vehicle_snapshots || [];
  const candSnaps = job.result.candidate?.vehicle_snapshots || [];
  if (!baseSnaps.length) return;

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const W = chartEl.offsetWidth || 800;
  const H = 110;
  chartEl.width = W;
  chartEl.height = H;
  const ctx = chartEl.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  const DIRS = ["northbound", "southbound", "eastbound", "westbound"];
  const COLORS = { northbound: "#42d8c5", southbound: "#ffb038", eastbound: "#ffe03a", westbound: "#6ab8ff" };
  const PAD = { t: 6, r: 60, b: 20, l: 38 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;

  // Find max queue value
  let maxQ = 10;
  for (const snaps of [baseSnaps, candSnaps]) {
    for (const snap of snaps) {
      for (const dir of DIRS) maxQ = Math.max(maxQ, snap.directions?.[dir]?.queue_m || 0);
    }
  }

  // Grid
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = PAD.t + cH - (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(PAD.l + cW, y); ctx.stroke();
    ctx.fillStyle = isDark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.35)";
    ctx.font = "8px Menlo, monospace";
    ctx.textAlign = "right";
    ctx.fillText(Math.round((i / 4) * maxQ) + "m", PAD.l - 3, y + 3);
  }

  // Lines: baseline (dashed) and candidate (solid), per direction
  for (const dir of DIRS) {
    const col = COLORS[dir];
    for (const [snaps, dashed] of [[baseSnaps, true], [candSnaps, false]]) {
      if (!snaps.length) continue;
      ctx.beginPath();
      snaps.forEach((snap, i) => {
        const x = PAD.l + (i / (snaps.length - 1 || 1)) * cW;
        const y = PAD.t + cH - ((snap.directions?.[dir]?.queue_m || 0) / maxQ) * cH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = col + (dashed ? "70" : "cc");
      ctx.lineWidth = dashed ? 1.2 : 2;
      ctx.setLineDash(dashed ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Current time marker
  const allLen = Math.max(baseSnaps.length, candSnaps.length);
  if (allLen > 1) {
    const mx = PAD.l + (simAnim.snapIdx / (allLen - 1)) * cW;
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(mx, PAD.t); ctx.lineTo(mx, PAD.t + cH); ctx.stroke();
  }

  // Legend
  const LX = W - PAD.r + 6;
  DIRS.forEach((dir, i) => {
    const ly = PAD.t + 8 + i * 20;
    ctx.fillStyle = COLORS[dir];
    ctx.fillRect(LX, ly - 6, 12, 4);
    ctx.fillStyle = isDark ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.55)";
    ctx.font = "8px Menlo, monospace";
    ctx.textAlign = "left";
    ctx.fillText(dir.slice(0, 1).toUpperCase(), LX + 14, ly - 2);
  });
  // Labels
  ctx.fillStyle = isDark ? "rgba(255,255,255,.3)" : "rgba(0,0,0,.3)";
  ctx.font = "8px Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("━ candidate  ╌ baseline  |  Queue depth over time (m)", PAD.l, H - 2);
}

function setupMapInteraction() {
  const canvas = els.mapCanvas;
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
  // Model evaluation (one-time load)
  refreshModelEvaluation();
  // Historical analytics (one-time load)
  refreshHistoricalAnalytics();
  refreshTrafficCounts();
  setInterval(refreshTrafficCounts, 30_000);
  scheduleRender();
}


// ── Persistent init retry with exponential backoff ─────────
let _initAttempt = 0;
const _INIT_MAX_BACKOFF_MS = 15000;

function _retryInit() {
  _initAttempt += 1;
  const delay = Math.min(_INIT_MAX_BACKOFF_MS, 1500 * Math.pow(1.5, _initAttempt - 1));
  setConnectionStatus("reconnecting", `retry ${_initAttempt} in ${Math.round(delay / 1000)}s`);
  setTimeout(() => {
    init().catch((err) => {
      console.warn(`init attempt ${_initAttempt} failed:`, err.message);
      _showRetryButton();
      _retryInit(); // keep retrying
    });
  }, delay);
}

function _showRetryButton() {
  if (document.getElementById("init-retry-btn")) return;
  const btn = document.createElement("button");
  btn.id = "init-retry-btn";
  btn.textContent = "⟳ Connection lost — click to reload";
  btn.style.cssText = [
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%)",
    "padding:12px 28px;background:#ff6d75;color:#fff;border:none",
    "border-radius:24px;font-size:1rem;font-weight:700;cursor:pointer",
    "z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5)",
  ].join(";");
  btn.onclick = () => location.reload();
  document.body.appendChild(btn);
}

// ── Tab switching — runs synchronously (defer = DOM already ready) ──
(function setupTabSwitching() {
  const tabBar = document.getElementById("tab-bar");
  if (!tabBar) return;
  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn || !btn.dataset.tab) return;
    const targetId = btn.dataset.tab;
    tabBar.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    const target = document.getElementById(targetId);
    if (target) target.classList.add("active");
    document.dispatchEvent(new CustomEvent("its:tabchange", { detail: { tabId: targetId } }));
    if (targetId === "tab-twin" && els.twinMap && state.liveState) {
      try { drawMapOnCanvas(els.twinMap); } catch (err) { console.debug(err); }
    }
    if (targetId === "tab-chat") {
      refreshChatHealth();
    }
    // Stop simulation animation when leaving the simulation tab
    if (targetId !== "tab-simulation") {
      stopSimulationAnimation();
    }
    if (targetId === "tab-simulation") {
      updateSimLiveBaseline();
    }
  });
})();

// ── Alert Dispatch Panel ────────────────────────────────────
async function refreshAlertDispatch() {
  const infoEl = document.getElementById("dispatch-info");
  const logEl = document.getElementById("dispatch-log");
  const badgeEl = document.getElementById("dispatch-status-badge");
  if (!infoEl) return;
  try {
    const res = await fetch("/api/alert-dispatch");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const enabled = data.enabled ?? false;
    const channels = (data.channels || []).join(", ") || "none";
    const total = data.total_dispatched ?? 0;
    const pending = data.pending_count ?? 0;
    if (badgeEl) {
      badgeEl.textContent = enabled ? "Active" : "Disabled";
      badgeEl.className = `badge ${enabled ? "badge-green" : "badge-neutral"}`;
    }
    infoEl.innerHTML = `
      <table class="data-table">
        <tbody>
          <tr><td>Status</td><td><strong>${enabled ? "✅ Enabled" : "⏸ Disabled"}</strong></td></tr>
          <tr><td>Channels</td><td>${channels}</td></tr>
          <tr><td>Total Dispatched</td><td>${total}</td></tr>
          <tr><td>Pending</td><td>${pending}</td></tr>
        </tbody>
      </table>`;
    const recent = (data.recent || []).slice(0, 5);
    if (recent.length > 0) {
      const rows = recent.map(a => `
        <tr>
          <td><span class="badge badge-red">${a.severity || "?"}</span></td>
          <td>${a.incident_type || "—"}</td>
          <td>${a.direction || "—"}</td>
          <td>${(a.message || "").substring(0, 60)}</td>
        </tr>`).join("");
      logEl.innerHTML = `
        <p class="eyebrow" style="margin-bottom:6px;">Recent Dispatches</p>
        <table class="data-table">
          <thead><tr><th>Severity</th><th>Type</th><th>Direction</th><th>Message</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else {
      logEl.innerHTML = `<p class="text-secondary" style="margin-top:8px;">No alerts dispatched yet.</p>`;
    }
  } catch (err) {
    if (infoEl) infoEl.innerHTML = `<p class="text-secondary">Dispatch status unavailable.</p>`;
    console.debug("refreshAlertDispatch:", err.message);
  }
}

// ── Grounded Chat Tab ───────────────────────────────────────
async function refreshChatHealth() {
  const chatBadge = document.getElementById("chat-health-badge");
  const sysBadge = document.getElementById("sys-chat-status-badge");
  const sysRuntime = document.getElementById("sys-chat-runtime");
  const unavailable = document.getElementById("chat-unavailable");
  try {
    const res = await fetch("/api/chat/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.chatHealth = data;
    const ready = !!data.ready;
    const label = `${data.provider || "llm"} · ${data.model || "model"}`;
    if (chatBadge) {
      chatBadge.textContent = ready ? `Ready: ${label}` : `Unavailable: ${data.model || "LLM"}`;
      chatBadge.className = `badge ${ready ? "badge-live" : "badge-warn"}`;
    }
    if (sysBadge) {
      sysBadge.textContent = ready ? "Ready" : "Unavailable";
      sysBadge.className = `badge ${ready ? "badge-green" : "badge-warn"}`;
    }
    if (sysRuntime) {
      const toolCount = Array.isArray(data.mcp_tools) ? data.mcp_tools.length : 0;
      sysRuntime.innerHTML = `
        <table class="data-table">
          <tbody>
            <tr><td>Provider</td><td>${data.provider || "—"}</td></tr>
            <tr><td>Model</td><td>${data.model || "—"}</td></tr>
            <tr><td>Status</td><td>${ready ? "Ready" : (data.reason || "Unavailable")}</td></tr>
            <tr><td>MCP Tools</td><td>${toolCount}</td></tr>
            <tr><td>Cloud Fallback</td><td>${data.cloud_fallback_enabled ? "Enabled" : "Disabled"}</td></tr>
          </tbody>
        </table>`;
    }
    if (unavailable) {
      unavailable.style.display = ready ? "none" : "block";
      unavailable.textContent = data.reason || "The local LLM runtime is not ready.";
    }
  } catch (err) {
    if (chatBadge) {
      chatBadge.textContent = "LLM: unavailable";
      chatBadge.className = "badge badge-warn";
    }
    if (sysBadge) {
      sysBadge.textContent = "Unavailable";
      sysBadge.className = "badge badge-warn";
    }
    if (sysRuntime) sysRuntime.innerHTML = `<p class="text-secondary">Chat runtime unavailable: ${err.message}</p>`;
    if (unavailable) {
      unavailable.style.display = "block";
      unavailable.textContent = `Chat runtime unavailable: ${err.message}`;
    }
  }
}

function hasArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function renderMarkdown(text) {
  const dir = hasArabic(text) ? "rtl" : "auto";
  // Escape HTML entities first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Headings
  html = html.replace(/^### (.+)$/gm, `<h4 dir="${dir}">$1</h4>`);
  html = html.replace(/^## (.+)$/gm, `<h3 dir="${dir}">$1</h3>`);
  html = html.replace(/^# (.+)$/gm, `<h2 dir="${dir}">$1</h2>`);
  // Bold + italic combo
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Unordered list items — convert leading * or - to <li>
  html = html.replace(/^[ \t]*[*\-] (.+)$/gm, `<li dir="${dir}">$1</li>`);
  // Wrap consecutive <li> blocks in <ul>
  html = html.replace(/(<li dir="[^"]+">.*<\/li>(\n|$))+/g, (match) => `<ul dir="${dir}">${match}</ul>`);
  // Horizontal rule
  html = html.replace(/^---+$/gm, "<hr>");
  // Double newline → paragraph break
  html = html.replace(/\n{2,}/g, `</p><p dir="${dir}">`);
  // Single newline → line break
  html = html.replace(/\n/g, "<br>");
  return `<p dir="${dir}">${html}</p>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appendChatMessage(kind, text, citations = [], debug = null) {
  const msgsEl = document.getElementById("chat-messages");
  if (!msgsEl) return null;
  const msg = document.createElement("div");
  msg.className = `assistant-msg assistant-msg--${kind}`;
  if (kind === "bot") {
    msg.innerHTML = renderMarkdown(text);
  } else {
    msg.setAttribute("dir", hasArabic(text) ? "rtl" : "ltr");
    msg.textContent = text;
  }
  msgsEl.appendChild(msg);

  // Show citations
  if (citations.length) {
    const row = document.createElement("div");
    row.className = "chat-citation-row";
    for (const citation of citations) {
      const chip = document.createElement("button");
      chip.className = "chat-citation-chip";
      chip.type = "button";
      const icon = {"live_state":"📡","live_history":"📊","detector_peak_hours":"📈","insight":"💡","signal_logs":"🚦","incident_annotations":"⚠️","congestion_events":"🚧","metadata":"📋"}[citation.source_type] || "📄";
      chip.textContent = `${icon} ${citation.title || citation.source_type || citation.ref_id}`;
      chip.title = citation.locator || citation.ref_id;
      chip.addEventListener("click", () => openChatReference(citation.ref_id));
      row.appendChild(chip);
    }
    msg.appendChild(row);
  }
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return msg;
}

async function openChatReference(refId) {
  if (!refId) return;
  const empty = document.getElementById("chat-reference-empty");
  const content = document.getElementById("chat-reference-content");
  if (!content) return;
  try {
    const res = await fetch(`/api/chat/reference/${encodeURIComponent(refId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ref = await res.json();
    if (empty) empty.style.display = "none";
    content.style.display = "flex";
    // Build a human-readable summary — no raw field cards
    const timeLabel = ref.timestamp_or_range || "—";
    const sourceLabel = ref.source_type || "data";
    const summary = buildRefSummary(ref);
    const sourceIcon = {"live_state":"📡","live_history":"📊","detector_peak_hours":"📈","insight":"💡","signal_logs":"🚦","incident_annotations":"⚠️","congestion_events":"🚧","metadata":"📋","model_evaluation":"🤖"}[sourceLabel] || "📄";
    const scopeBadge = ref.timestamp_or_range?.includes("historical") || sourceLabel.includes("detector") || sourceLabel.includes("incident")
      ? `<span class="cref-scope-badge cref-scope-historical">تاريخية</span>`
      : `<span class="cref-scope-badge cref-scope-live">مباشرة</span>`;

    content.innerHTML = `
      <div class="cref-header">
        <h3 class="cref-title">${sourceIcon} ${escapeHtml(ref.title || "Source Reference")}</h3>
        <div class="cref-tags">
          ${scopeBadge}
          <span class="cref-tag">${escapeHtml(sourceLabel)}</span>
          <span class="cref-time">${escapeHtml(timeLabel)}</span>
        </div>
      </div>
      <div class="cref-summary">${summary}</div>
      ${ref.locator ? `<div class="cref-locator"><code>MCP: ${escapeHtml(ref.locator)}</code></div>` : ""}
      ${ref.api_origin ? `<div class="cref-api-origin">API: <code>${escapeHtml(ref.api_origin)}</code></div>` : ""}
      ${ref.file_origin ? `<div class="cref-api-origin">File: <code>${escapeHtml(ref.file_origin)}</code></div>` : ""}
      ${renderReferenceRawJson(ref)}
      ${ref.ui_target ? `<button id="chat-reference-jump" class="btn btn-primary cref-jump-btn" type="button">→ فتح العرض المرتبط</button>` : ""}`;
    const jump = document.getElementById("chat-reference-jump");
    if (jump) jump.addEventListener("click", () => navigateToUiTarget(ref.ui_target));
  } catch (err) {
    if (empty) empty.style.display = "none";
    content.style.display = "flex";
    content.innerHTML = `<p class="text-secondary">Reference unavailable: ${err.message}</p>`;
  }
}

function renderReferenceRawJson(ref) {
  if (!ref?.raw_json_available && !ref?.structured_payload) return "";
  const payload = ref.structured_payload ?? {};
  const raw = JSON.stringify(payload, null, 2);
  return `<details class="cref-raw-json" open>
    <summary>Raw JSON</summary>
    <pre><code>${escapeHtml(raw)}</code></pre>
  </details>`;
}

// Build a readable prose summary for the reference panel (no raw field cards)
function buildRefSummary(ref) {
  const payload = ref.structured_payload || {};
  const t = ref.render_type || "";

  if (t === "live_metric_card") {
    const dir = escapeHtml(payload.direction || "");
    const level = escapeHtml(payload.congestion_level || payload.google?.congestion_level || "—");
    const delay = payload.delay_s ?? payload.google?.delay_s;
    const speed = payload.avg_speed_kmh ?? payload.google?.avg_speed_kmh;
    const queue = payload.queue_m;
    const parts = [];
    if (dir) parts.push(`<strong>${dir}</strong>`);
    if (level !== "—") parts.push(`مستوى الازدحام: <strong>${level}</strong>`);
    if (delay != null) parts.push(`تأخير: <strong>${delay}s</strong>`);
    if (speed != null) parts.push(`سرعة: <strong>${speed} km/h</strong>`);
    if (queue != null) parts.push(`طابور: <strong>${queue} m</strong>`);
    return `<p class="cref-prose">${parts.join(" · ") || "Live traffic data"}</p>`;
  }

  if (t === "peak_hours") {
    const items = (payload.top_hours || []).slice(0, 3);
    if (!items.length) return `<p class="cref-prose">Historical peak-hour data</p>`;
    const rows = items.map(i =>
      `<div class="cref-peek-row"><span>${escapeHtml(i.weekday)} ${String(i.hour).padStart(2,"0")}:00</span><strong>${Math.round(i.mean_veh_h)} veh/h</strong></div>`
    ).join("");
    return `<div class="cref-peek">${rows}</div>`;
  }

  if (t === "heatmap_cell") {
    const v = payload.mean_veh_h;
    return `<p class="cref-prose">${escapeHtml(payload.direction || "")} · ${escapeHtml(payload.weekday || "")} ${String(payload.hour ?? 0).padStart(2,"0")}:00 · <strong>${v == null ? "No data" : Math.round(v) + " veh/h"}</strong></p>`;
  }

  if (t === "event_list") {
    const events = (payload.events || payload.incidents || []).slice(0, 4);
    if (!events.length) return `<p class="cref-prose">No events found</p>`;
    return `<div class="cref-peek">${events.map(e =>
      `<div class="cref-peek-row"><span class="cref-severity-${escapeHtml(e.severity || "")}">${escapeHtml(e.incident_type || e.event_type || "event")}</span><strong>${escapeHtml(e.start_time || e.date || e.description || "")}</strong></div>`
    ).join("")}</div>`;
  }

  if (t === "zone_preview") {
    const zones = (payload.monitoring_zones || []).slice(0, 4);
    return `<div class="cref-peek">${zones.map(z =>
      `<div class="cref-peek-row"><span>${escapeHtml(z.zone_id)}</span><strong>${escapeHtml(z.type || z.kind || "zone")}</strong></div>`
    ).join("") || "<p class='cref-prose'>Zone data</p>"}</div>`;
  }

  // Generic: show first 3 readable key-value pairs
  const kvs = Object.entries(payload)
    .filter(([, v]) => v != null && typeof v !== "object")
    .slice(0, 4);
  if (!kvs.length) return `<p class="cref-prose">${escapeHtml(ref.source_type || "Reference data")}</p>`;
  return `<div class="cref-peek">${kvs.map(([k, v]) =>
    `<div class="cref-peek-row"><span>${escapeHtml(k.replace(/_/g, " "))}</span><strong>${escapeHtml(String(v))}</strong></div>`
  ).join("")}</div>`;
}

function renderReferenceView(ref) {
  const payload = ref.structured_payload || {};
  if (ref.render_type === "live_metric_card") return renderLiveReference(payload);
  if (ref.render_type === "peak_hours") return renderPeakReference(payload);
  if (ref.render_type === "heatmap_cell") return renderHeatmapReference(payload);
  if (ref.render_type === "event_list") return renderEventReference(payload);
  if (ref.render_type === "zone_preview") return renderZoneReference(payload);
  return renderTableReference(payload);
}

function renderLiveReference(payload) {
  const rows = Object.entries(payload).filter(([, value]) => value == null || typeof value !== "object").slice(0, 8);
  return `<div class="ref-card-grid">${rows.map(([key, value]) => `
    <div class="ref-mini-card"><span>${escapeHtml(key.replace(/_/g, " "))}</span><strong>${escapeHtml(value ?? "—")}</strong></div>
  `).join("")}</div>${payload.google ? renderTableReference(payload.google) : ""}`;
}

function renderPeakReference(payload) {
  const items = payload.top_hours || [];
  if (!items.length) return renderTableReference(payload);
  const max = Math.max(1, ...items.map((item) => item.mean_veh_h || 0));
  return `<div class="ref-bars">${items.map((item) => `
    <div class="ref-bar-row"><span>${escapeHtml(item.weekday)} ${String(item.hour).padStart(2, "0")}:00</span><div><i style="width:${Math.max(4, ((item.mean_veh_h || 0) / max) * 100)}%"></i></div><strong>${Math.round(item.mean_veh_h || 0)}</strong></div>
  `).join("")}</div>`;
}

function renderHeatmapReference(payload) {
  return `<div class="ref-mini-card wide">
    <span>${escapeHtml(payload.direction || "Direction")} · ${escapeHtml(payload.weekday || "day")} ${String(payload.hour ?? 0).padStart(2, "0")}:00</span>
    <strong>${payload.mean_veh_h == null ? "No detector data" : `${Math.round(payload.mean_veh_h)} veh/h`}</strong>
  </div>`;
}

function renderEventReference(payload) {
  const events = payload.events || payload.incidents || [];
  if (!events.length) return renderTableReference(payload);
  return `<div class="ref-event-list">${events.slice(0, 6).map((event) => `
    <div><strong>${escapeHtml(event.incident_type || event.event_type || event.severity || "event")}</strong><span>${escapeHtml(event.start_time || event.start || event.date || event.description || "historical record")}</span></div>
  `).join("")}</div>`;
}

function renderZoneReference(payload) {
  const zones = payload.monitoring_zones || [];
  if (!zones.length) return renderTableReference(payload);
  return `<div class="ref-event-list">${zones.map((zone) => `
    <div><strong>${escapeHtml(zone.zone_id)}</strong><span>${escapeHtml(zone.type || zone.kind || "zone")} · approaches ${(zone.approaches || zone.approach_ids || []).join(", ")}</span></div>
  `).join("")}</div>`;
}

function renderTableReference(payload) {
  if (!payload || typeof payload !== "object") return `<p class="text-secondary">${escapeHtml(payload || "No structured payload")}</p>`;
  const rows = Object.entries(payload).slice(0, 12).map(([key, value]) => `
    <div class="ref-table-row"><span>${escapeHtml(key)}</span><strong>${escapeHtml(typeof value === "object" ? JSON.stringify(value).slice(0, 120) : value)}</strong></div>
  `).join("");
  return `<div class="ref-table">${rows}</div>`;
}

function navigateToUiTarget(uiTarget) {
  if (!uiTarget) return;
  const [tabId, elementId] = String(uiTarget).split(":");
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (tabBtn) tabBtn.click();
  if (elementId) {
    setTimeout(() => {
      const target = document.getElementById(elementId);
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }
}

(function setupChat() {
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const resetBtn = document.getElementById("chat-reset-btn");
  if (!inputEl || !sendBtn) return;

  async function sendQuery() {
    const message = inputEl.value.trim();
    if (!message) return;
    inputEl.value = "";
    sendBtn.disabled = true;
    appendChatMessage("user", message);
    const thinking = appendChatMessage("thinking", "Thinking...");
    try {
      const res = await fetch("/api/chat/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversation_id: state.chatConversationId }),
      });
      const data = await res.json();
      if (thinking) thinking.remove();
      state.chatConversationId = data.conversation_id || state.chatConversationId;
      if (data.answer) {
        appendChatMessage("bot", data.answer, data.citations || [], data.debug);
      } else {
        appendChatMessage("refused", data.refusal_reason || "No answer available.");
      }
    } catch (err) {
      if (thinking) thinking.remove();
      appendChatMessage("refused", `Could not reach the chat service: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
    }
  }

  sendBtn.addEventListener("click", sendQuery);
  inputEl.addEventListener("keydown", (e) => { if (e.key === "Enter") sendQuery(); });
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/chat/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_id: state.chatConversationId }),
        });
      } catch {/* best-effort reset */}
      state.chatConversationId = null;
      const msgsEl = document.getElementById("chat-messages");
      if (msgsEl) {
        msgsEl.innerHTML = `<div class="assistant-msg assistant-msg--system">Ask about live congestion, historical incidents, signal phases, peak hours, emissions, or system data.</div>`;
      }
    });
  }
  refreshChatHealth();
})();

// Refresh dispatch when System tab is opened
(function watchSystemTab() {
  const tabBar = document.getElementById("tab-bar");
  if (!tabBar) return;
  tabBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn && btn.dataset.tab === "tab-system") {
      refreshAlertDispatch();
      refreshChatHealth();
    }
  });
})();

init().catch((error) => {
  console.error("init failed (attempt 1):", error);
  setConnectionStatus("failed");
  showToast(`Connection failed — retrying… (${error.message})`, "error", 5000);
  _showRetryButton();
  _retryInit();
});
