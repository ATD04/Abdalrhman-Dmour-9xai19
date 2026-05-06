(function setupReportsTab() {
  const els = {
    tab: document.getElementById("tab-reports"),
    empty: document.getElementById("report-empty"),
    content: document.getElementById("report-content"),
    useLlm: document.getElementById("report-use-llm"),
    refreshBtn: document.getElementById("report-refresh-btn"),
    generateBtn: document.getElementById("report-generate-btn"),
    downloadJsonBtn: document.getElementById("report-download-json-btn"),
    downloadPdfBtn: document.getElementById("report-download-pdf-btn"),
    metaGrid: document.getElementById("report-meta-grid"),
    modeBadge: document.getElementById("report-mode-badge"),
    llmBadge: document.getElementById("report-llm-badge"),
    incidentBadge: document.getElementById("report-incident-badge"),
    forecastBadge: document.getElementById("report-forecast-badge"),
    status: document.getElementById("report-status"),
    actions: document.getElementById("report-actions"),
    incidents: document.getElementById("report-incidents"),
    approachBody: document.getElementById("report-approach-body"),
    forecastGrid: document.getElementById("report-forecast-grid"),
    health: document.getElementById("report-health"),
    rawJsonCode: document.getElementById("report-raw-json-code"),
  };
  if (!els.tab) return;

  const reportState = {
    payload: null,
    loaded: false,
    loading: false,
  };
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

  async function optionalJson(url, options) {
    try {
      return await fetchJson(url, options);
    } catch (error) {
      if ([404, 405, 503].includes(error.status)) {
        return null;
      }
      throw error;
    }
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeTimeDiffSeconds(start, end) {
    const startTs = start ? new Date(start).getTime() : NaN;
    const endTs = end ? new Date(end).getTime() : NaN;
    if (Number.isNaN(startTs) || Number.isNaN(endTs)) return 0;
    return Math.max(0, Math.round((endTs - startTs) / 100) / 10);
  }

  function dedupeIncidents(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = JSON.stringify({
        type: item.incident_type || item.type || item.event_type,
        direction: item.direction || null,
        message: item.message || null,
        wall_time: item.wall_time || null,
      });
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function collectIncidents(liveState, history) {
    const incidents = [];
    const wallTime = liveState?.wall_time || null;
    for (const event of liveState?.insights?.events || []) {
      incidents.push({ source: "insight", wall_time: wallTime, ...event });
    }
    for (const item of liveState?.anomaly?.incidents || []) {
      incidents.push({ source: "anomaly", wall_time: wallTime, ...item });
    }
    for (const item of liveState?.video_incidents || []) {
      incidents.push({ source: "video_incident", wall_time: wallTime, ...item });
    }
    for (const point of (history || []).slice(-20)) {
      for (const event of point.events || []) {
        incidents.push({ source: "history_event", wall_time: point.wall_time, ...event });
      }
      for (const event of point.anomaly_incidents || []) {
        incidents.push({ source: "history_anomaly", wall_time: point.wall_time, ...event });
      }
      for (const event of point.video_incidents || []) {
        incidents.push({ source: "history_video_incident", wall_time: point.wall_time, ...event });
      }
    }
    const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return dedupeIncidents(incidents).sort((a, b) => {
      const left = severityRank[String(a.severity || "").toUpperCase()] ?? 9;
      const right = severityRank[String(b.severity || "").toUpperCase()] ?? 9;
      if (left !== right) return left - right;
      return String(a.wall_time || "").localeCompare(String(b.wall_time || ""));
    });
  }

  function buildCompatibilityReport(liveState, history, forecast, videoStats, preferLlm, reason) {
    const baseline = history?.[0]?.per_direction || history?.[0]?.metrics || {};
    const metrics = liveState?.metrics || {};
    const google = liveState?.google_snapshot || {};
    const demand = liveState?.demand || {};
    const incidents = collectIncidents(liveState, history);
    const approaches = DIRECTIONS.map((direction) => {
      const current = metrics[direction] || {};
      const previous = baseline[direction] || {};
      const corridor = google[direction] || {};
      const demandState = demand[direction] || {};
      return {
        direction,
        queue_m: Number(num(current.queue_m).toFixed(1)),
        queue_delta_m: Number((num(current.queue_m) - num(previous.queue_m)).toFixed(1)),
        flow_veh_h: Number(num(current.flow_veh_h).toFixed(1)),
        avg_speed_kmh: Number(num(current.avg_speed_kmh).toFixed(1)),
        google_delay_s: Number(num(corridor.delay_s).toFixed(1)),
        pressure_index: Number(num(demandState.pressure_index).toFixed(3)),
        saturation_ratio: Number(num(demandState.saturation_ratio).toFixed(3)),
        congestion_level: corridor.congestion_level || null,
      };
    });

    const severeIncidents = incidents.filter((item) => ["CRITICAL", "HIGH"].includes(String(item.severity || "").toUpperCase()));
    const actions = [];
    for (const incident of severeIncidents.slice(0, 4)) {
      actions.push({
        priority: String(incident.severity || "").toUpperCase() === "CRITICAL" ? 1 : 2,
        category: "incident_response",
        direction: incident.direction || null,
        title: incident.direction ? `Inspect ${incident.direction} approach immediately` : "Inspect active incident immediately",
        reason: incident.message || incident.incident_type || incident.type || "Confirmed high-severity incident.",
      });
    }
    for (const direction of DIRECTIONS) {
      const sixty = (forecast?.directions?.[direction] || []).find((item) => item.horizon_minutes === 60);
      if (sixty && (sixty.spillback_risk === "HIGH" || sixty.recommendation === "EXTEND_GREEN")) {
        actions.push({
          priority: 3,
          category: "signal_timing",
          direction,
          title: `Prepare longer green on ${direction}`,
          reason: `60-minute forecast is ${Math.round(num(sixty.veh_per_hour))} veh/h with ${sixty.spillback_risk || "LOW"} spillback risk.`,
        });
      }
    }
    if (!actions.length) {
      const dominant = liveState?.insights?.dominant_queue_direction || "northbound";
      actions.push({
        priority: 4,
        category: "monitoring",
        direction: dominant,
        title: `Keep monitoring ${dominant}`,
        reason: "No critical incidents or endpoint-backed report route is available, so a local compatibility report was generated.",
      });
    }

    const countsBySeverity = {};
    for (const incident of incidents) {
      const severity = String(incident.severity || "INFO").toUpperCase();
      countsBySeverity[severity] = (countsBySeverity[severity] || 0) + 1;
    }

    const windowStart = history?.[0]?.wall_time || liveState?.wall_time || null;
    const windowEnd = history?.[history.length - 1]?.wall_time || liveState?.wall_time || null;
    const dominant = liveState?.insights?.dominant_queue_direction || "northbound";
    const queueTotal = Number(num(liveState?.insights?.total_queue_m).toFixed(1));
    const avgSpeed = Number(num(liveState?.insights?.avg_network_speed_kmh).toFixed(1));

    return {
      schema_version: 1,
      report_type: "operational_situation",
      generated_at: new Date().toISOString(),
      metadata: {
        report_id: `compat-${Date.now()}`,
        generation_mode: "compatibility_local_builder",
        time_window: {
          history_points: history?.length || 0,
          window_start: windowStart,
          window_end: windowEnd,
          duration_s: safeTimeDiffSeconds(windowStart, windowEnd),
        },
        llm: {
          requested: Boolean(preferLlm),
          used: false,
          reason,
        },
      },
      sections: {
        status: {
          summary: `Compatibility report: network queue is ${queueTotal} m at ${avgSpeed} km/h average speed, and the most stressed approach is ${dominant}.`,
          engine_status: liveState?.status || "unknown",
          source: liveState?.source || "--",
          phase_label: liveState?.signal_plan?.phase_label || "--",
          adaptive_active: Boolean(liveState?.adaptive_active),
          network_queue_m: queueTotal,
          network_avg_speed_kmh: avgSpeed,
          dominant_queue_direction: dominant,
        },
        approaches,
        incidents: {
          active_count: incidents.length,
          high_severity_count: severeIncidents.length,
          by_severity: countsBySeverity,
          recent: incidents.slice(0, 10),
        },
        forecasts: forecast || {
          available: false,
          mode: null,
          directions: {},
        },
        actions: actions.sort((a, b) => a.priority - b.priority).slice(0, 5),
        health: {
          engine_status: liveState?.status || "unknown",
          data_source: liveState?.source || "--",
          data_freshness_s: safeTimeDiffSeconds(liveState?.wall_time, new Date().toISOString()),
          forecasting: {
            available: Boolean(forecast?.available),
            mode: forecast?.mode || null,
            horizons: forecast?.horizons || [],
          },
          video: videoStats?.describe || videoStats?.stats ? {
            running: Boolean(videoStats?.running),
            incident_count: (videoStats?.incidents || []).length,
          } : { running: false },
          alert_dispatch: liveState?.alert_dispatch || { enabled: false },
        },
      },
    };
  }

  async function buildCompatibilityReportFromApi(preferLlm, reason) {
    const [liveState, history, forecast, videoStats] = await Promise.all([
      fetchJson("/api/live-state"),
      optionalJson("/api/live-history").then((payload) => payload || []),
      optionalJson("/api/flow-forecast?horizon=60"),
      optionalJson("/api/live-video-stats"),
    ]);
    const forecastPayload = forecast ? { available: true, ...forecast } : { available: false, mode: null, directions: {} };
    return buildCompatibilityReport(liveState, history, forecastPayload, videoStats, preferLlm, reason);
  }

  function severityPill(level) {
    const upper = String(level || "LOW").toUpperCase();
    const css = upper === "CRITICAL" ? "critical" : upper === "HIGH" ? "high" : upper === "MEDIUM" ? "medium" : "low";
    return `<span class="rr-pill rr-pill-${css}">${escapeHtml(upper)}</span>`;
  }

  function formatTime(value) {
    if (!value) return "--";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }

  function setExportButtonsEnabled(enabled) {
    if (els.downloadJsonBtn) {
      els.downloadJsonBtn.disabled = !enabled;
    }
    if (els.downloadPdfBtn) {
      els.downloadPdfBtn.disabled = !enabled;
    }
  }

  function reportFileStem(payload = reportState.payload) {
    const raw = payload?.metadata?.report_id || payload?.generated_at || `situation-report-${Date.now()}`;
    const clean = String(raw)
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return clean || `situation-report-${Date.now()}`;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 0);
  }

  function wrapText(text, maxChars = 88) {
    const source = String(text ?? "").trim();
    if (!source) return [""];
    const words = source.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxChars) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
      }
      current = word;
    }
    if (current) {
      lines.push(current);
    }
    return lines;
  }

  function pdfSafeText(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildReportExportLines(payload) {
    const metadata = payload?.metadata || {};
    const sections = payload?.sections || {};
    const status = sections.status || {};
    const incidents = sections.incidents || {};
    const actions = sections.actions || [];
    const approaches = sections.approaches || [];
    const forecasts = sections.forecasts || {};
    const health = sections.health || {};
    const lines = [];
    lines.push("Situation Report");
    lines.push(`Generated: ${formatTime(payload?.generated_at)}`);
    lines.push(`Report ID: ${metadata.report_id || "--"}`);
    lines.push(`Mode: ${metadata.generation_mode || "--"}`);
    lines.push("");
    lines.push("Network Status");
    lines.push(...wrapText(`Summary: ${status.summary || "No summary available."}`));
    lines.push(`Source: ${status.source || "--"}`);
    lines.push(`Phase: ${status.phase_label || "--"}`);
    lines.push(`Network Queue: ${status.network_queue_m ?? "--"} m`);
    lines.push(`Average Speed: ${status.network_avg_speed_kmh ?? "--"} km/h`);
    lines.push(`Adaptive Control: ${status.adaptive_active ? "Enabled" : "Disabled"}`);
    lines.push("");
    lines.push("Recommended Actions");
    if (actions.length) {
      actions.forEach((action) => {
        lines.push(...wrapText(`P${action.priority || "-"} ${action.title || "Action"} - ${action.reason || "No reason supplied."}`));
      });
    } else {
      lines.push("No actions were generated.");
    }
    lines.push("");
    lines.push("Incidents");
    if ((incidents.recent || []).length) {
      incidents.recent.forEach((incident) => {
        lines.push(...wrapText(`${incident.severity || "INFO"} ${incident.direction || ""} ${incident.incident_type || incident.type || "incident"} - ${incident.message || "No detail supplied."}`));
      });
    } else {
      lines.push("No incidents were captured in the current window.");
    }
    lines.push("");
    lines.push("Approach Snapshot");
    approaches.forEach((row) => {
      lines.push(
        `${row.direction}: queue ${row.queue_m} m, delta ${row.queue_delta_m} m, flow ${row.flow_veh_h} veh/h, speed ${row.avg_speed_kmh} km/h, delay ${row.google_delay_s} s`
      );
    });
    lines.push("");
    lines.push("Forecast Outlook");
    if (forecasts.available && forecasts.directions) {
      Object.entries(forecasts.directions).forEach(([direction, items]) => {
        const interesting = (items || []).filter((item) => item.horizon_minutes === 15 || item.horizon_minutes === 60);
        if (!interesting.length) return;
        interesting.forEach((item) => {
          lines.push(`${direction}: ${item.horizon_minutes} min -> ${item.veh_per_hour} veh/h (${item.spillback_risk || "LOW"} risk)`);
        });
      });
    } else {
      lines.push("Forecast data is unavailable.");
    }
    lines.push("");
    lines.push("System Health");
    lines.push(`Engine Status: ${health.engine_status || "--"}`);
    lines.push(`Data Source: ${health.data_source || "--"}`);
    lines.push(`Data Freshness: ${health.data_freshness_s ?? "--"} s`);
    lines.push(`Forecasting: ${health.forecasting?.available ? health.forecasting?.mode || "ready" : "Unavailable"}`);
    lines.push(`Video Runtime: ${health.video?.running ? "Running" : "Stopped"}`);
    lines.push(`LLM Path: ${metadata.llm?.used ? "Enhanced" : metadata.llm?.reason || "Fallback"}`);
    return lines;
  }

  function buildPdfBlob(lines) {
    const pageWidth = 595;
    const pageHeight = 842;
    const marginLeft = 48;
    const top = 794;
    const bottom = 52;
    const lineHeight = 15;
    const pages = [];
    let current = [];
    let y = top;
    for (const rawLine of lines) {
      const text = pdfSafeText(rawLine);
      if (y < bottom) {
        pages.push(current);
        current = [];
        y = top;
      }
      current.push({ x: marginLeft, y, text });
      y -= lineHeight;
    }
    if (!pages.length || current.length) {
      pages.push(current);
    }

    const objects = [null];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    const pageObjectIds = [];
    const fontObjectId = 3;
    objects.push("PAGES_PLACEHOLDER");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    for (const page of pages) {
      const pageObjectId = objects.length;
      const contentObjectId = pageObjectId + 1;
      pageObjectIds.push(pageObjectId);
      const stream = [
        "BT",
        "/F1 11 Tf",
        "0 0 0 rg",
        ...page.map((line) => `1 0 0 1 ${line.x} ${line.y} Tm (${line.text}) Tj`),
        "ET",
      ].join("\n");
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`
      );
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    }
    objects[2] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = pdf.length;
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length}\n`;
    pdf += "0000000000 65535 f \n";
    for (let id = 1; id < objects.length; id += 1) {
      pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  function exportReportJson() {
    if (!reportState.payload) return;
    const blob = new Blob([JSON.stringify(reportState.payload, null, 2)], { type: "application/json" });
    triggerDownload(blob, `${reportFileStem()}.json`);
  }

  function exportReportPdf() {
    if (!reportState.payload) return;
    const lines = buildReportExportLines(reportState.payload);
    const blob = buildPdfBlob(lines);
    triggerDownload(blob, `${reportFileStem()}.pdf`);
  }

  function renderReport() {
    const payload = reportState.payload;
    if (!payload) {
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = "Open Reports to load the latest operational summary.";
      }
      if (els.content) {
        els.content.style.display = "none";
      }
      setExportButtonsEnabled(false);
      return;
    }

    const metadata = payload.metadata || {};
    const sections = payload.sections || {};
    const status = sections.status || {};
    const incidents = sections.incidents || {};
    const forecasts = sections.forecasts || {};
    const actions = sections.actions || [];
    const llm = metadata.llm || {};

    if (els.empty) {
      els.empty.style.display = "none";
    }
    if (els.content) {
      els.content.style.display = "block";
    }
    if (els.modeBadge) {
      els.modeBadge.textContent = `Mode: ${metadata.generation_mode || "--"}`;
    }
    if (els.llmBadge) {
      els.llmBadge.textContent = llm.used ? "LLM: enhanced" : "LLM: fallback";
    }
    if (els.incidentBadge) {
      els.incidentBadge.textContent = `Incidents: ${incidents.active_count || 0}`;
    }
    if (els.forecastBadge) {
      els.forecastBadge.textContent = forecasts.available
        ? `Forecast: ${forecasts.mode || "ready"}`
        : "Forecast: unavailable";
    }

    if (els.metaGrid) {
      const windowMeta = metadata.time_window || {};
      els.metaGrid.innerHTML = `
        <div class="rr-meta-card"><span>Generated</span><strong>${escapeHtml(formatTime(payload.generated_at))}</strong></div>
        <div class="rr-meta-card"><span>Report ID</span><strong>${escapeHtml(metadata.report_id || "--")}</strong></div>
        <div class="rr-meta-card"><span>History Window</span><strong>${escapeHtml(windowMeta.duration_s ?? 0)} s</strong></div>
        <div class="rr-meta-card"><span>Snapshots</span><strong>${escapeHtml(windowMeta.history_points ?? 0)}</strong></div>
      `;
    }

    if (els.status) {
      els.status.innerHTML = `
        <div class="rr-status-summary">
          <div class="rr-status-note"><strong>${escapeHtml(status.summary || "No summary available.")}</strong></div>
          <p>Phase: <strong>${escapeHtml(status.phase_label || "--")}</strong></p>
          <p>Source: <strong>${escapeHtml(status.source || "--")}</strong></p>
          <p>Queue: <strong>${escapeHtml(status.network_queue_m ?? "--")} m</strong> · Speed: <strong>${escapeHtml(status.network_avg_speed_kmh ?? "--")} km/h</strong></p>
          <p>Adaptive control: <strong>${status.adaptive_active ? "Enabled" : "Disabled"}</strong></p>
        </div>
      `;
    }

    if (els.actions) {
      els.actions.innerHTML = actions.length
        ? actions.map((action) => `
            <article class="rr-action-item">
              <strong>P${escapeHtml(action.priority)} · ${escapeHtml(action.title)}</strong>
              <p>${escapeHtml(action.reason || "No reason supplied.")}</p>
              <div class="rr-action-meta">
                <span class="rr-pill rr-pill-low">${escapeHtml(action.category || "action")}</span>
                ${action.direction ? `<span class="rr-pill rr-pill-medium">${escapeHtml(action.direction)}</span>` : ""}
              </div>
            </article>
          `).join("")
        : `<div class="empty-state">No actions were generated.</div>`;
    }

    if (els.incidents) {
      const recent = incidents.recent || [];
      els.incidents.innerHTML = recent.length
        ? `<div class="rr-incident-list">${recent.map((incident) => `
            <article class="rr-incident-item">
              <strong>${escapeHtml(incident.incident_type || incident.type || incident.event_type || "incident")}</strong>
              <p>${escapeHtml(incident.message || "No detail supplied.")}</p>
              <div class="rr-incident-meta">
                ${severityPill(incident.severity)}
                ${incident.direction ? `<span class="rr-pill rr-pill-medium">${escapeHtml(incident.direction)}</span>` : ""}
                ${incident.wall_time ? `<span class="rr-pill rr-pill-low">${escapeHtml(formatTime(incident.wall_time))}</span>` : ""}
              </div>
            </article>
          `).join("")}</div>`
        : `<div class="empty-state">No incidents were captured in the current window.</div>`;
    }

    if (els.approachBody) {
      els.approachBody.innerHTML = (sections.approaches || []).map((row) => `
        <tr>
          <td>${escapeHtml(row.direction)}</td>
          <td>${escapeHtml(row.queue_m)} m</td>
          <td>${escapeHtml(row.queue_delta_m)} m</td>
          <td>${escapeHtml(row.flow_veh_h)} veh/h</td>
          <td>${escapeHtml(row.avg_speed_kmh)} km/h</td>
          <td>${escapeHtml(row.google_delay_s)} s</td>
          <td>${escapeHtml(row.pressure_index)}</td>
        </tr>
      `).join("");
    }

    if (els.forecastGrid) {
      const directions = forecasts.directions || {};
      const cards = Object.entries(directions).map(([direction, items]) => {
        const interesting = items.filter((item) => item.horizon_minutes === 15 || item.horizon_minutes === 60);
        return `
          <section class="rr-forecast-card">
            <h4>${escapeHtml(direction)}</h4>
            ${interesting.map((item) => `
              <div class="rr-forecast-row">
                <span>${escapeHtml(item.horizon_minutes)} min</span>
                <strong>${escapeHtml(item.veh_per_hour)} veh/h</strong>
                <span>${escapeHtml(item.spillback_risk || "LOW")} risk</span>
              </div>
            `).join("")}
          </section>
        `;
      });
      els.forecastGrid.innerHTML = cards.length
        ? cards.join("")
        : `<div class="empty-state">Forecast data is not available for this report.</div>`;
    }

    if (els.health) {
      const health = sections.health || {};
      const forecasting = health.forecasting || {};
      const video = health.video || {};
      const llmText = llm.used ? "Enhanced" : (llm.reason || "Fallback");
      els.health.innerHTML = `
        <div class="rr-health-grid">
          <div class="ref-table-row"><span>Engine Status</span><strong>${escapeHtml(health.engine_status || "--")}</strong></div>
          <div class="ref-table-row"><span>Data Source</span><strong>${escapeHtml(health.data_source || "--")}</strong></div>
          <div class="ref-table-row"><span>Data Freshness</span><strong>${escapeHtml(health.data_freshness_s ?? "--")} s</strong></div>
          <div class="ref-table-row"><span>Forecasting</span><strong>${forecasting.available ? escapeHtml(forecasting.mode || "ready") : "Unavailable"}</strong></div>
          <div class="ref-table-row"><span>Video Runtime</span><strong>${video.running ? "Running" : "Stopped"}</strong></div>
          <div class="ref-table-row"><span>LLM Path</span><strong>${escapeHtml(llmText)}</strong></div>
        </div>
      `;
    }

    if (els.rawJsonCode) {
      els.rawJsonCode.textContent = JSON.stringify(payload, null, 2);
    }
    setExportButtonsEnabled(true);
  }

  async function loadLatestReport(force = false) {
    if (reportState.loading || (reportState.loaded && !force)) {
      return;
    }
    reportState.loading = true;
    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "Loading latest operational report...";
    }
    try {
      try {
        reportState.payload = await fetchJson("/api/report/latest");
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        reportState.payload = await buildCompatibilityReportFromApi(
          false,
          "The running server does not expose /api/report/latest yet, so a compatibility report was built from the available live APIs."
        );
      }
      reportState.loaded = true;
      renderReport();
    } catch (error) {
      reportState.loaded = true;
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = `Latest report is unavailable: ${error.message}`;
      }
      if (els.content) {
        els.content.style.display = "none";
      }
      setExportButtonsEnabled(false);
    } finally {
      reportState.loading = false;
    }
  }

  async function generateReport() {
    if (reportState.loading) return;
    reportState.loading = true;
    if (els.generateBtn) {
      els.generateBtn.disabled = true;
    }
    if (els.empty) {
      els.empty.style.display = "block";
      els.empty.textContent = "Generating the latest operational report...";
    }
    try {
      const preferLlm = !!els.useLlm?.checked;
      try {
        reportState.payload = await fetchJson("/api/report/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefer_llm: preferLlm }),
        });
      } catch (error) {
        if (error.status !== 404) {
          throw error;
        }
        reportState.payload = await buildCompatibilityReportFromApi(
          preferLlm,
          preferLlm
            ? "Ollama phrasing needs the newer report endpoint, so this report was generated locally in compatibility mode."
            : "The running server does not expose /api/report/generate yet, so this report was generated locally in compatibility mode."
        );
      }
      reportState.loaded = true;
      renderReport();
    } catch (error) {
      reportState.loaded = true;
      if (els.empty) {
        els.empty.style.display = "block";
        els.empty.textContent = `Report generation failed: ${error.message}`;
      }
      if (els.content) {
        els.content.style.display = "none";
      }
      setExportButtonsEnabled(false);
    } finally {
      if (els.generateBtn) {
        els.generateBtn.disabled = false;
      }
      reportState.loading = false;
    }
  }

  els.refreshBtn?.addEventListener("click", () => {
    reportState.loaded = false;
    loadLatestReport(true);
  });
  els.generateBtn?.addEventListener("click", () => generateReport());
  els.downloadJsonBtn?.addEventListener("click", () => exportReportJson());
  els.downloadPdfBtn?.addEventListener("click", () => exportReportPdf());

  document.addEventListener("its:tabchange", (event) => {
    if (event?.detail?.tabId === "tab-reports") {
      loadLatestReport();
    }
  });

  document.getElementById("tab-bar")?.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab-btn");
    if (btn?.dataset?.tab === "tab-reports") {
      loadLatestReport();
    }
  });
})();
