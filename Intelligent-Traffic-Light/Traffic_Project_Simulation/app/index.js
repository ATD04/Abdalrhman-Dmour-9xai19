const state = {
  config: null,
  geometry: null,
  liveState: null,
  history: [],
  eventSource: null,
  mapMode: "sumo", // "sumo" | "satellite"
};

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
const mapView = { scale: 1, offsetX: 0, offsetY: 0 };
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

async function fetchJSON(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

function setAdaptiveBadge() {
  const active = !!state.liveState?.adaptive_active;
  els.adaptiveToggle.textContent = `Adaptive: ${active ? "ON" : "OFF"}`;
}

function bindEvents() {
  els.adaptiveToggle.addEventListener("click", async () => {
    const nextState = !(state.liveState?.adaptive_active);
    const response = await fetch("/api/adaptive-toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nextState }),
    });
    if (!response.ok || !state.liveState) return;
    const payload = await response.json();
    state.liveState.adaptive_active = payload.adaptive_active;
    render();
  });

  // ── Map mode toggle ──────────────────────────────────────────
  els.mapModeSumo.addEventListener("click", () => setMapMode("sumo"));
  els.mapModeSatellite.addEventListener("click", () => setMapMode("satellite"));
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

function renderHeader(live) {
  const isGoogleLive = live.source === "google_routes" || live.source === "google_routes_stale";
  const banner = document.getElementById("data-source-banner");
  const bannerLabel = document.getElementById("data-source-label");
  const bannerDetail = document.getElementById("data-source-detail");
  const centerLat = live.simulation_center?.lat;
  const centerLon = live.simulation_center?.lon;
  const stale = live.source === "google_routes_stale";

  banner.className = `data-source-banner ${isGoogleLive ? "banner-live" : "banner-fallback"}`;
  bannerLabel.textContent = isGoogleLive
    ? stale
      ? "Live Google snapshot temporarily stale"
      : "Live data from Google Routes API"
    : "Fallback data source active";
  bannerDetail.textContent = isGoogleLive
    ? `Wadi Saqra intersection, refreshed at ${formatTime(live.wall_time)}`
    : (live.google_error || "Google traffic source is unavailable.");

  els.sourceBadge.textContent = isGoogleLive ? "Source: Google Routes API" : "Source: Fallback mode";
  els.sourceBadge.className = `badge ${isGoogleLive ? "badge-live" : "badge-warn"}`;
  els.centerBadge.textContent = centerLat
    ? `Wadi Saqra (${centerLat.toFixed(4)}, ${centerLon.toFixed(4)})`
    : "Center: --";
  els.refreshBadge.textContent = `Updated: ${formatTime(live.wall_time)}`;
  els.vehicleCountChip.textContent = `${live.vehicles?.length || 0} vehicles in simulation`;
}

function renderKpis(live) {
  const insights = live.insights || {};
  els.kpiQueue.textContent = queueDescription(insights.total_queue_m);
  els.kpiSpeed.textContent = `${(insights.avg_network_speed_kmh || 0).toFixed(1)} km/h`;
  els.kpiDominant.textContent = directionLabel(insights.dominant_queue_direction);
  els.kpiGoogle.textContent = directionLabel(insights.google_delay_direction);
  els.tlsId.textContent = live.signal_plan?.tls_id ? "Active junction controller" : "No active controller";
  els.googleErrorChip.textContent = live.source === "google_routes" ? "Google live" : "Using fallback";
  els.googleErrorChip.className = `badge ${live.source === "google_routes" ? "badge-live" : "badge-warn"}`;
  els.recommendation.textContent = insights.recommendation || "No active recommendation.";
  setAdaptiveBadge();
}

function renderAlerts(events) {
  els.alertList.innerHTML = "";
  if (!events || !events.length) {
    const quiet = document.createElement("article");
    quiet.className = "alert-card";
    quiet.innerHTML = "<strong>Stable</strong><p>No high-priority alert is active right now.</p>";
    els.alertList.appendChild(quiet);
    return;
  }

  const EVENT_ICONS = {
    spillback: "🚨",
    abnormal_stop: "⚠️",
    congestion_surge: "📈",
    heavy_congestion: "🟠",
  };
  const SEVERITY_CLASS = {
    critical: "high",
    high: "high",
    warning: "medium",
    medium: "medium",
    info: "",
  };

  events.forEach((event) => {
    const card = document.createElement("article");
    const sevClass = SEVERITY_CLASS[event.severity] || "";
    card.className = `alert-card event-card ${sevClass}`;
    const icon = EVENT_ICONS[event.type] || "ℹ️";
    const dirLabel = event.direction ? ` · ${directionLabel(event.direction)}` : "";
    card.innerHTML = `
      <div class="event-card-header">
        <span class="event-icon">${icon}</span>
        <strong>${event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}${dirLabel}</strong>
      </div>
      <p>${event.message}</p>
      ${event.tip ? `<p class="event-tip">💡 ${event.tip}</p>` : ""}
    `;
    els.alertList.appendChild(card);
  });
}

// ── Webster Signal Timing Panel — table format ───────────────
function renderWebsterPanel(rec) {
  if (!rec || !els.websterPanel) return;

  const modeLabels = {
    three_phase: "3-Phase · Optimized",
    saturated: "Saturated",
    field_plan_optimal: "Field Plan Optimal",
  };
  if (els.websterModeBadge) {
    els.websterModeBadge.textContent = modeLabels[rec.mode] || rec.mode;
    els.websterModeBadge.className = `badge ${
      rec.mode === "saturated" ? "badge-warn" :
      rec.mode === "three_phase" ? "badge-live" : "badge-muted"
    }`;
  }

  const phases = rec.phases || [];
  const ns   = phases.find((p) => p.directions && p.directions.includes("northbound")) || {};
  const east = phases.find((p) => p.directions && p.directions.includes("eastbound"))  || {};
  const west = phases.find((p) => p.directions && p.directions.includes("westbound"))  || {};

  const isSaturated = rec.mode === "saturated";
  const isOptimal   = rec.mode === "field_plan_optimal";
  const recLabel = isSaturated
    ? "Saturated — field plan held"
    : isOptimal
      ? "Field plan is already optimal"
      : "Recommended · now";
  const recClass = (!isSaturated && !isOptimal) ? "webster-row-recommended" : "";

  const curDelay = (rec.current_delay_s_veh     || 0).toFixed(2);
  const recDelay = (rec.recommended_delay_s_veh || 0).toFixed(2);

  const Y   = (rec.flow_ratio_total || 0).toFixed(2);
  const yns = (rec.y_ns || 0).toFixed(2);
  const ye  = (rec.y_e  || 0).toFixed(2);
  const yw  = (rec.y_w  || 0).toFixed(2);

  const delayHtml = rec.delay_reduction_pct > 0
    ? `est. delay reduction <span class="webster-improvement-inline">▼ ${rec.delay_reduction_pct}%</span>`
    : rec.delay_reduction_pct < 0
      ? `<span class="webster-sat-label">↑ delay would increase — field plan held</span>`
      : `field plan already optimal`;

  const satWarnHtml = rec.saturation_warning
    ? `<div class="webster-saturation-warn">⚠️ ${rec.saturation_warning}</div>`
    : "";

  els.websterPanel.innerHTML = `
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
            <td><span class="webster-plan-label">Current (field)</span></td>
            <td>${(ns.current_green_s   || 35).toFixed(1)}s</td>
            <td>${(east.current_green_s || 35).toFixed(1)}s</td>
            <td>${(west.current_green_s || 35).toFixed(1)}s</td>
            <td>3.0s</td><td>2.0s</td>
            <td>120.0s</td>
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
    <p class="webster-footnote">Webster (1958) 3-phase · HCM flow ratios · near-saturation guard active</p>
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
  els.signalPhaseSummary.innerHTML = `
    <strong>${plan.phase_label || "Signal phase"}</strong>
    <span>${signalBadge(plan.phase_kind)}</span>
    <small>${activeText} · ${Math.round(plan.remaining_s || 0)}s remaining · cycle ${Math.round(plan.cycle_length_s || 0)}s${plan.extension_applied_s ? ` · +${Math.round(plan.extension_applied_s)}s adaptive hold` : ""}</small>
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

function drawLanes(ctx, width, height, laneMetrics) {
  (state.geometry.lanes || []).forEach((lane) => {
    const metric = laneMetrics[lane.id];
    drawProjectedPath(ctx, lane.shape, width, height, "rgba(8, 16, 23, 0.95)", lane.role === "monitor" ? 7.8 : 4.2, 1);
    drawProjectedPath(ctx, lane.shape, width, height, lane.role === "monitor" ? "rgba(194, 209, 218, 0.28)" : "rgba(111, 129, 140, 0.18)", lane.role === "monitor" ? 4.6 : 1.9, 1);
    if (lane.role === "monitor") {
      drawProjectedPath(ctx, lane.shape, width, height, laneStatusColor(metric), 2.4, 0.9);
      if (metric?.signal_state && metric.signal_state !== "unknown") {
        drawLaneStopBar(ctx, lane, width, height, laneStatusColor(metric));
      }
      drawLaneQueueBubble(ctx, lane, metric, width, height);
    }
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

function drawMap() {
  const canvas = els.mapCanvas;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const live = state.liveState;
  if (!live || !state.geometry) return;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07111a";
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(mapView.offsetX, mapView.offsetY);
  ctx.scale(mapView.scale, mapView.scale);
  drawGoogleCorridors(ctx, width, height, live.google_snapshot || {});
  drawLanes(ctx, width, height, live.lane_metrics || {});
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
  const history = state.history || [];

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07111a";
  ctx.fillRect(0, 0, width, height);
  if (!history.length) return;

  const padding = 28;
  const queueValues = history.map((item) => item.total_queue_m || 0);
  const speedValues = history.map((item) => item.avg_network_speed_kmh || 0);
  const maxQueue = Math.max(...queueValues, 1);
  const maxSpeed = Math.max(...speedValues, 1);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  for (let step = 0; step <= 4; step += 1) {
    const y = padding + ((height - padding * 2) / 4) * step;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ffbf69";
  ctx.beginPath();
  queueValues.forEach((value, index) => {
    const x = padding + (index / Math.max(queueValues.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (value / maxQueue) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.strokeStyle = "#45d5a0";
  ctx.beginPath();
  speedValues.forEach((value, index) => {
    const x = padding + (index / Math.max(speedValues.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (value / maxSpeed) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#ffbf69";
  ctx.font = "11px Menlo, monospace";
  ctx.textAlign = "left";
  ctx.fillText("Queue length", padding, 16);
  ctx.fillStyle = "#45d5a0";
  ctx.fillText("Average network speed", padding + 100, 16);
}

function render() {
  if (!state.liveState || !state.geometry) return;
  const live = state.liveState;
  renderHeader(live);
  renderKpis(live);
  renderSignalPlan(live.signal_plan || {}, live.metrics || {});
  renderAlerts(live.insights?.events || []);
  renderWebsterPanel(live.signal_recommendation || null);
  renderApproachTable(live.metrics || {}, live.google_snapshot || {}, live.demand || {});
  renderNotes(live);
  renderMapStory(live);
  if (state.mapMode === "sumo") drawMap();
  drawHistory();
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

function connectEventSource() {
  state.eventSource = new EventSource("/api/live-events");
  state.eventSource.addEventListener("state", (event) => {
    state.liveState = JSON.parse(event.data);
    state.history.push({
      wall_time: state.liveState.wall_time,
      total_queue_m: state.liveState.insights?.total_queue_m || 0,
      avg_network_speed_kmh: state.liveState.insights?.avg_network_speed_kmh || 0,
    });
    if (state.history.length > 600) {
      state.history = state.history.slice(-600);
    }
    render();
  });
}

async function init() {
  const [config, geometry, liveState, history] = await Promise.all([
    fetchJSON("/api/live-config"),
    fetchJSON("/api/network-geometry"),
    fetchJSON("/api/live-state"),
    fetchJSON("/api/live-history"),
  ]);

  state.config = config;
  state.geometry = geometry;
  state.liveState = liveState;
  state.history = history || [];
  bindEvents();
  setupMapInteraction();
  connectEventSource();
  render();
}

init().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<pre style="color:#fff;padding:24px">Failed to initialize live dashboard: ${error.message}</pre>`;
});
