(function setupReplayTab() {
  const els = {
    tab: document.getElementById("tab-replay"),
    empty: document.getElementById("replay-empty"),
    content: document.getElementById("replay-content"),
    refreshBtn: document.getElementById("replay-refresh-btn"),
    playBtn: document.getElementById("replay-play-btn"),
    countBadge: document.getElementById("replay-count-badge"),
    positionBadge: document.getElementById("replay-position-badge"),
    phaseBadge: document.getElementById("replay-phase-badge"),
    sourceBadge: document.getElementById("replay-source-badge"),
    markerSummary: document.getElementById("replay-marker-summary"),
    markerFilter: document.getElementById("replay-marker-filter"),
    slider: document.getElementById("replay-slider"),
    kpiGrid: document.getElementById("replay-kpi-grid"),
    markers: document.getElementById("replay-markers"),
    deltaSummary: document.getElementById("replay-delta-summary"),
    directionBody: document.getElementById("replay-direction-body"),
  };
  if (!els.tab) return;

  const replayState = {
    payload: null,
    filteredSnapshots: [],
    cursor: 0,
    filter: "ALL",
    compatMode: false,
    loaded: false,
    loading: false,
    playTimer: null,
    lastFetchMs: 0,
  };
  const REPLAY_REFRESH_MS = 20_000;
  const DIRECTIONS = ["northbound", "southbound", "eastbound", "westbound"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fetchJson(url, options) {
    return fetch(url, options).then(async (response) => {
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response.json();
    });
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseTime(value) {
    if (!value) return null;
    const normalized = String(value).endsWith("Z")
      ? `${String(value).slice(0, -1)}+00:00`
      : String(value);
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function timelineLabel(wallTime, simTimeS) {
    const parsed = parseTime(wallTime);
    if (parsed) {
      return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    }
    return `t+${Math.round(num(simTimeS))}s`;
  }

  function marker(type, label, detail = {}) {
    return { type, label, detail };
  }

  function dedupeMarkers(markers) {
    const seen = new Set();
    return markers.filter((item) => {
      const key = JSON.stringify({ type: item.type, label: item.label, detail: item.detail || {} });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizeReplaySnapshot(point, previous, index, firstPoint) {
    const perDirection = point.per_direction || point.metrics || {};
    const metrics = {};
    const directionRows = [];
    for (const direction of DIRECTIONS) {
      const current = perDirection[direction] || {};
      const previousData = previous?.metrics?.[direction] || {};
      const row = {
        direction,
        queue_m: Number(num(current.queue_m).toFixed(1)),
        flow_veh_h: Number(num(current.flow_veh_h).toFixed(1)),
        avg_speed_kmh: Number(num(current.avg_speed_kmh).toFixed(1)),
        google_delay_s: Number(num(current.google_delay_s ?? current.delay_s).toFixed(1)),
      };
      row.delta = {
        queue_m: Number((row.queue_m - num(previousData.queue_m)).toFixed(1)),
        flow_veh_h: Number((row.flow_veh_h - num(previousData.flow_veh_h)).toFixed(1)),
        avg_speed_kmh: Number((row.avg_speed_kmh - num(previousData.avg_speed_kmh)).toFixed(1)),
        google_delay_s: Number((row.google_delay_s - num(previousData.google_delay_s ?? previousData.delay_s)).toFixed(1)),
      };
      metrics[direction] = {
        queue_m: row.queue_m,
        flow_veh_h: row.flow_veh_h,
        avg_speed_kmh: row.avg_speed_kmh,
        google_delay_s: row.google_delay_s,
      };
      directionRows.push(row);
    }

    const queueTotal = Number(num(point.queue_total_m ?? point.total_queue_m).toFixed(1));
    const avgSpeed = Number(num(point.network_avg_speed_kmh ?? point.avg_network_speed_kmh).toFixed(1));
    const queueDelta = Number((queueTotal - num(previous?.queue_total_m)).toFixed(1));
    const speedDelta = Number((avgSpeed - num(previous?.network_avg_speed_kmh)).toFixed(1));
    const vehicleDelta = Math.round(num(point.vehicle_count) - num(previous?.vehicle_count));
    const wallTime = point.wall_time;
    const firstWall = parseTime(firstPoint?.wall_time);
    const currentWall = parseTime(wallTime);
    const elapsedS = firstWall && currentWall
      ? Math.max(0, Math.round((currentWall.getTime() - firstWall.getTime()) / 100) / 10)
      : Math.max(0, Number((num(point.sim_time_s) - num(firstPoint?.sim_time_s)).toFixed(1)));
    const markers = [...(point.markers || [])];

    if (previous?.phase_label && point.phase_label && previous.phase_label !== point.phase_label) {
      markers.push(marker("phase_change", `phase -> ${point.phase_label}`, { from: previous.phase_label, to: point.phase_label }));
    }
    if (previous && queueDelta >= 20) {
      markers.push(marker("queue_jump", `queue +${Math.round(queueDelta)} m`, { delta_queue_m: queueDelta }));
    }
    if (previous && speedDelta <= -5) {
      markers.push(marker("speed_drop", `speed ${speedDelta.toFixed(1)} km/h`, { delta_speed_kmh: speedDelta }));
    }
    for (const event of point.events || []) {
      const label = event.incident_type || event.event_type || event.type || "event";
      markers.push(marker("event", String(label), event));
    }
    for (const incident of point.anomaly_incidents || []) {
      const label = incident.incident_type || incident.type || "anomaly";
      markers.push(marker("anomaly_spike", String(label), incident));
    }
    for (const incident of point.video_incidents || []) {
      const label = incident.incident_type || incident.type || "visual incident";
      markers.push(marker("incident", String(label), incident));
    }

    const uniqueMarkers = dedupeMarkers(markers);
    return {
      index,
      wall_time: wallTime,
      timeline_label: timelineLabel(wallTime, point.sim_time_s),
      elapsed_s: elapsedS,
      sim_time_s: point.sim_time_s,
      source: point.source,
      vehicle_count: Math.round(num(point.vehicle_count)),
      queue_total_m: queueTotal,
      network_avg_speed_kmh: avgSpeed,
      dominant_queue_direction: point.dominant_queue_direction,
      phase_label: point.phase_label,
      active_directions: point.active_directions || [],
      cycle_length_s: point.cycle_length_s,
      adaptive_active: Boolean(point.adaptive_active),
      delta: {
        vehicle_count: vehicleDelta,
        queue_total_m: queueDelta,
        network_avg_speed_kmh: speedDelta,
      },
      metrics,
      direction_rows: directionRows,
      markers: uniqueMarkers,
      marker_types: [...new Set(uniqueMarkers.map((item) => item.type).filter(Boolean))].sort(),
    };
  }

  function buildReplayPayloadFromHistory(history) {
    const snapshots = [];
    const markerCounts = {};
    const firstPoint = Array.isArray(history) && history.length ? history[0] : null;
    let previous = null;
    for (const [index, point] of (history || []).entries()) {
      const snapshot = normalizeReplaySnapshot(point || {}, previous, index, firstPoint);
      snapshots.push(snapshot);
      for (const type of snapshot.marker_types || []) {
        markerCounts[type] = (markerCounts[type] || 0) + 1;
      }
      previous = snapshot;
    }
    const availableMarkerTypes = Object.keys(markerCounts).sort();
    return {
      schema_version: 2,
      count: snapshots.length,
      available_marker_types: availableMarkerTypes,
      summary: {
        oldest_wall_time: snapshots[0]?.wall_time || null,
        newest_wall_time: snapshots[snapshots.length - 1]?.wall_time || null,
        duration_s: snapshots.length > 1
          ? Number((num(snapshots[snapshots.length - 1].elapsed_s) - num(snapshots[0].elapsed_s)).toFixed(1))
          : 0,
        max_queue_total_m: Math.max(0, ...snapshots.map((item) => num(item.queue_total_m))),
        min_network_avg_speed_kmh: snapshots.length ? Math.min(...snapshots.map((item) => num(item.network_avg_speed_kmh))) : 0,
        max_vehicle_count: Math.max(0, ...snapshots.map((item) => num(item.vehicle_count))),
        marker_counts: markerCounts,
      },
      snapshots,
    };
  }

  function formatSigned(value, unit = "") {
    const num = Number(value || 0);
    const prefix = num > 0 ? "+" : "";
    const suffix = unit ? ` ${unit}` : "";
    return `${prefix}${num.toFixed(unit ? 1 : 0)}${suffix}`.replace(".0 ", " ").replace(".0", "");
  }

  function metricClass(value) {
    const num = Number(value || 0);
    if (num > 0) return "rr-delta-up";
    if (num < 0) return "rr-delta-down";
    return "";
  }

  function markerPill(markerType) {
    const key = String(markerType || "info").toLowerCase();
    const kind = key.includes("incident") || key.includes("anomaly") ? "critical" :
      key.includes("queue") || key.includes("event") ? "high" :
      key.includes("speed") ? "medium" : "low";
    return `<span class="rr-pill rr-pill-${kind}">${escapeHtml(markerType || "marker")}</span>`;
  }

  function currentSnapshot() {
    return replayState.filteredSnapshots[replayState.cursor] || null;
  }

  function stopPlayback() {
    if (replayState.playTimer) {
      clearInterval(replayState.playTimer);
      replayState.playTimer = null;
    }
    if (els.playBtn) {
      els.playBtn.textContent = "Play";
    }
  }

  function clampCursor() {
    const max = Math.max(0, replayState.filteredSnapshots.length - 1);
    replayState.cursor = Math.min(max, Math.max(0, replayState.cursor));
  }

  function applyFilter() {
    const snapshots = replayState.payload?.snapshots || [];
    replayState.filteredSnapshots = replayState.filter === "ALL"
      ? snapshots
      : snapshots.filter((snapshot) => (snapshot.marker_types || []).includes(replayState.filter));
    clampCursor();
    renderReplay();
  }

  function renderReplay() {
    const snapshot = currentSnapshot();
    const total = replayState.payload?.count || 0;
    if (els.countBadge) {
      els.countBadge.textContent = `Snapshots: ${total}${replayState.compatMode ? " · compat" : ""}`;
    }
    if (!snapshot) {
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = replayState.loaded
          ? "No replay snapshots match the selected marker filter."
          : "Open Replay to load the chronological buffer.";
      }
      if (els.content) {
        els.content.style.display = "none";
      }
      if (els.positionBadge) {
        els.positionBadge.textContent = "--";
      }
      stopPlayback();
      return;
    }

    if (els.empty) {
      els.empty.style.display = "none";
    }
    if (els.content) {
      els.content.style.display = "block";
    }
    if (els.positionBadge) {
      els.positionBadge.textContent = `${snapshot.timeline_label} · ${replayState.cursor + 1}/${replayState.filteredSnapshots.length}`;
    }
    if (els.phaseBadge) {
      els.phaseBadge.textContent = `Phase: ${snapshot.phase_label || "--"}`;
    }
    if (els.sourceBadge) {
      els.sourceBadge.textContent = `Source: ${snapshot.source || "--"}`;
    }
    if (els.markerSummary) {
      els.markerSummary.textContent = `${(snapshot.markers || []).length} marker(s)`;
    }
    if (els.slider) {
      els.slider.max = String(Math.max(0, replayState.filteredSnapshots.length - 1));
      els.slider.value = String(replayState.cursor);
    }

    if (els.kpiGrid) {
      els.kpiGrid.innerHTML = `
        <div class="rr-kpi-card"><span>Wall Time</span><strong>${escapeHtml(snapshot.timeline_label)}</strong></div>
        <div class="rr-kpi-card"><span>Network Queue</span><strong>${escapeHtml(snapshot.queue_total_m)} m</strong></div>
        <div class="rr-kpi-card"><span>Avg Speed</span><strong>${escapeHtml(snapshot.network_avg_speed_kmh)} km/h</strong></div>
        <div class="rr-kpi-card"><span>Vehicles</span><strong>${escapeHtml(snapshot.vehicle_count)}</strong></div>
      `;
    }

    if (els.deltaSummary) {
      const delta = snapshot.delta || {};
      els.deltaSummary.innerHTML = `
        <div class="rr-delta-card"><span>Queue Delta</span><strong class="${metricClass(delta.queue_total_m)}">${escapeHtml(formatSigned(delta.queue_total_m, "m"))}</strong></div>
        <div class="rr-delta-card"><span>Speed Delta</span><strong class="${metricClass(delta.network_avg_speed_kmh)}">${escapeHtml(formatSigned(delta.network_avg_speed_kmh, "km/h"))}</strong></div>
        <div class="rr-delta-card"><span>Vehicle Delta</span><strong class="${metricClass(delta.vehicle_count)}">${escapeHtml(formatSigned(delta.vehicle_count))}</strong></div>
        <div class="rr-delta-card"><span>Adaptive</span><strong>${snapshot.adaptive_active ? "Enabled" : "Disabled"}</strong></div>
      `;
    }

    if (els.markers) {
      const markers = snapshot.markers || [];
      els.markers.innerHTML = markers.length
        ? markers.map((marker) => `
            <article class="rr-marker-chip">
              <strong>${escapeHtml(marker.label || marker.type || "marker")}</strong>
              <p>${escapeHtml(marker.detail?.message || marker.detail?.incident_type || marker.detail?.type || "Replay marker")}</p>
              <div class="rr-marker-meta">${markerPill(marker.type)}</div>
            </article>
          `).join("")
        : `<div class="empty-state">No markers were emitted for this snapshot.</div>`;
    }

    if (els.directionBody) {
      els.directionBody.innerHTML = (snapshot.direction_rows || []).map((row) => `
        <tr>
          <td>${escapeHtml(row.direction)}</td>
          <td>${escapeHtml(row.queue_m)} m</td>
          <td class="${metricClass(row.delta?.queue_m)}">${escapeHtml(formatSigned(row.delta?.queue_m, "m"))}</td>
          <td>${escapeHtml(row.flow_veh_h)} veh/h</td>
          <td>${escapeHtml(row.avg_speed_kmh)} km/h</td>
          <td>${escapeHtml(row.google_delay_s)} s</td>
        </tr>
      `).join("");
    }
  }

  async function loadReplay(force = false) {
    const stale = Date.now() - replayState.lastFetchMs > REPLAY_REFRESH_MS;
    if (replayState.loading || (replayState.loaded && !force && !stale)) {
      return;
    }
    replayState.loading = true;
    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "Loading replay timeline...";
    }
    try {
      let payload;
      let compatMode = false;
      try {
        payload = await fetchJson("/api/replay");
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        const history = await fetchJson("/api/live-history");
        payload = buildReplayPayloadFromHistory(history);
        compatMode = true;
      }
      replayState.payload = payload;
      replayState.compatMode = compatMode;
      replayState.loaded = true;
      replayState.lastFetchMs = Date.now();

      if (els.markerFilter) {
        const active = replayState.filter;
        const options = ["ALL"].concat(payload.available_marker_types || []);
        els.markerFilter.innerHTML = options.map((option) => `
          <option value="${escapeHtml(option)}">${option === "ALL" ? "All snapshots" : option}</option>
        `).join("");
        replayState.filter = options.includes(active) ? active : "ALL";
        els.markerFilter.value = replayState.filter;
      }
      applyFilter();
    } catch (error) {
      replayState.loaded = true;
      replayState.compatMode = false;
      replayState.payload = { count: 0, snapshots: [], available_marker_types: [] };
      replayState.filteredSnapshots = [];
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = `Replay is unavailable: ${error.message}`;
      }
      if (els.content) {
        els.content.style.display = "none";
      }
    } finally {
      replayState.loading = false;
    }
  }

  function togglePlayback() {
    if (!replayState.filteredSnapshots.length) return;
    if (replayState.playTimer) {
      stopPlayback();
      return;
    }
    if (els.playBtn) {
      els.playBtn.textContent = "Pause";
    }
    replayState.playTimer = setInterval(() => {
      if (replayState.cursor >= replayState.filteredSnapshots.length - 1) {
        stopPlayback();
        return;
      }
      replayState.cursor += 1;
      renderReplay();
    }, 900);
  }

  els.refreshBtn?.addEventListener("click", () => {
    stopPlayback();
    loadReplay(true);
  });
  els.playBtn?.addEventListener("click", () => togglePlayback());
  els.markerFilter?.addEventListener("change", () => {
    stopPlayback();
    replayState.filter = els.markerFilter.value || "ALL";
    applyFilter();
  });
  els.slider?.addEventListener("input", () => {
    stopPlayback();
    replayState.cursor = Number(els.slider.value || 0);
    renderReplay();
  });

  document.addEventListener("its:tabchange", (event) => {
    const tabId = event?.detail?.tabId;
    if (tabId === "tab-replay") {
      loadReplay();
      return;
    }
    stopPlayback();
  });

  document.getElementById("tab-bar")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab-btn");
    if (btn?.dataset?.tab === "tab-replay") {
      loadReplay();
    }
  });

  window.addEventListener("beforeunload", stopPlayback);
})();
