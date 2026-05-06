/* ═══════════════════════════════════════════════════════════════
   VIDEO ANALYTICS TAB – Wadi Saqra Traffic Control Room
   Full front-end logic: gallery, player, overlay, events, KPIs
   ═══════════════════════════════════════════════════════════════ */

const VA = {
    manifest: null,
    selectedVideoId: null,
    selectedTracking: null,
    selectionToken: 0,         // monotonic token to ignore stale async loads
    overlayRAF: null,
    overlayActive: false,
    els: {},
    handlers: {                // saved handlers for proper removal
        loadedmetadata: null,
        timeupdate: null,
        seekInput: null,
        play: null,
        seeking: null,
        seeked: null,
        pause: null,
        playClick: null,
    },
    currentEventId: null,
    cachedFrameKeys: null,     // cached sorted Number array for fast lookup
    zonePayload: null,
    zones: [],
    zoneMode: "view",
    zoneDraft: [],
    zonePointTarget: 4,  // how many points user wants to place
    _drawCursorX: null,
    _drawCursorY: null,
    // ── Zone entry counting ──────────────────────────────────
    zoneEntryCounts: {},      // zone_id → total unique entries (cumulative)
    zonePrevOccupants: {},    // zone_id → Set of track_ids inside in previous frame
    _lastCountedFrameKey: null,
    // ── Direction tracking ───────────────────────────────────
    trackPositionHistory: {}, // track_id → [{x,y}, ...] last 20 positions
};

const VA_CLASS_COLORS = {
    car: "#62d0c3",
    truck: "#ffb347",
    bus: "#ffd166",
    motorcycle: "#f39ae0",
    person: "#88c0fc",
};

// ── Utilities ──────────────────────────────────────────────────
function vaFetch(url, { timeoutMs = 10000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { signal: controller.signal })
        .then((r) => {
            clearTimeout(timer);
            if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
            return r.json();
        })
        .catch((err) => {
            clearTimeout(timer);
            throw err;
        });
}

function vaShowToast(message, kind = "info", duration = 3500) {
    if (typeof showToast === "function") {
        showToast(message, kind, duration);
    } else {
        console[kind === "error" ? "error" : "log"](`[VA] ${message}`);
    }
}

function fmtTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
}

function eventTypeLabel(t) {
    const map = {
        queue_pressure: "Queue / Spillback",
        pedestrian_presence: "Pedestrian",
        abnormal_stopping: "Abnormal Stop",
        incident_crash: "🚨 Crash / Incident",
        heavy_vehicle: "Heavy Vehicle",
    };
    return map[t] || t.replace(/_/g, " ");
}

// ── Initialization ─────────────────────────────────────────────
async function vaInit() {
    VA.els = {
        root: document.getElementById("va-root"),
        kpi: document.getElementById("va-kpi-strip"),
        gallery: document.getElementById("va-gallery"),
        playerWrap: document.getElementById("va-player-wrap"),
        video: document.getElementById("va-player-video"),
        canvas: document.getElementById("va-player-canvas"),
        overlayInfo: document.getElementById("va-overlay-info"),
        overlayTime: document.getElementById("va-overlay-time"),
        hudLeft: document.getElementById("va-hud-left"),
        hudRight: document.getElementById("va-hud-right"),
        playBtn: document.getElementById("va-play-btn"),
        seek: document.getElementById("va-seek"),
        timeLabel: document.getElementById("va-time-label"),
        eventsPanel: document.getElementById("va-events-panel"),
        useCases: document.getElementById("va-use-cases"),
        incidents: document.getElementById("va-incidents"),
        playerSection: document.getElementById("va-player-section"),
        timelineCanvas: document.getElementById("va-timeline-canvas"),
        zoneToolbar: document.getElementById("va-zone-toolbar"),
        zoneViewBtn: document.getElementById("va-zone-view"),
        zoneDrawBtn: document.getElementById("va-zone-draw"),
        zoneUndoBtn: document.getElementById("va-zone-undo"),
        zoneClearBtn: document.getElementById("va-zone-clear"),
        zoneResetBtn: document.getElementById("va-zone-reset"),
        zoneExportBtn: document.getElementById("va-zone-export"),
        zoneSaveBtn: document.getElementById("va-zone-save"),
        zoneDeleteBtn: document.getElementById("va-zone-delete"),
        zoneLabel: document.getElementById("va-zone-label"),
        zoneDirection: document.getElementById("va-zone-direction"),
        zoneList: document.getElementById("va-zone-list"),
    };

    VA.els.liveEventAlert = document.createElement("div");
    VA.els.liveEventAlert.className = "va-live-event-alert";
    VA.els.liveEventAlert.style.display = "none";
    document.getElementById("va-events-panel").parentNode.appendChild(VA.els.liveEventAlert);

    try {
        VA.manifest = await vaFetch("/api/video-analytics-manifest");
    } catch (e) {
        VA.els.root.innerHTML =
            '<div class="va-loading"><p>Video analytics data not available. Run the processing pipeline first.</p></div>';
        return;
    }

    renderVAKpis();
    renderGallery();
    renderUseCases();
    renderIncidents();
    bindZoneEditor();

    // select first video
    if (VA.manifest.videos && VA.manifest.videos.length > 0) {
        selectVideo(VA.manifest.videos[0].id);
    }
}

// ── KPIs ───────────────────────────────────────────────────────
function renderVAKpis() {
    const s = VA.manifest.summary;
    const inferenceFps = VA.manifest.inference_fps ?? VA.manifest.sample_fps ?? "–";
    const previewFps   = VA.manifest.preview_fps   ?? VA.manifest.processed_fps ?? "–";
    VA.els.kpi.innerHTML = `
    <div class="va-kpi">
      <span>Videos Analyzed</span>
      <strong>${s.video_count}</strong>
      <small>Wadi Saqra field recordings</small>
    </div>
    <div class="va-kpi">
      <span>Total Duration</span>
      <strong>${fmtTime(s.total_duration_s)}</strong>
      <small>${s.total_duration_s.toFixed(0)}s of footage</small>
    </div>
    <div class="va-kpi">
      <span>Tracked Objects</span>
      <strong>${s.tracked_objects.toLocaleString()}</strong>
      <small>vehicles + pedestrians</small>
    </div>
    <div class="va-kpi">
      <span>Events Detected</span>
      <strong>${s.total_events}</strong>
      <small>${s.high_severity_events} high severity</small>
    </div>
    <div class="va-kpi">
      <span>Use Cases Proven</span>
      <strong>${VA.manifest.use_cases.filter((u) => u.status === "proven").length} / ${VA.manifest.use_cases.length}</strong>
      <small>with video evidence</small>
    </div>
    <div class="va-kpi">
      <span>Model</span>
      <strong style="font-size:1.1rem">${VA.manifest.model_name}</strong>
      <small>Infer ${inferenceFps} fps · Preview ${previewFps} fps</small>
    </div>
  `;
}

// ── Gallery ────────────────────────────────────────────────────
function renderGallery() {
    VA.els.gallery.innerHTML = VA.manifest.videos
        .map((v) => {
            const highEvents = v.events.filter((e) => e.severity === "high").length;
            const badgeClass = highEvents > 0 ? "high" : v.events.length > 3 ? "medium" : "low";
            const badgeText = highEvents > 0 ? `${highEvents} HIGH` : `${v.events.length} events`;
            return `
      <div class="va-video-card" data-id="${v.id}" onclick="selectVideo('${v.id}')">
        <img class="va-video-thumb" src="${v.thumbnail_path}" alt="${v.label}" loading="lazy" />
        <span class="va-event-count-badge ${badgeClass}">${badgeText}</span>
        <div class="va-video-card-body">
          <h4>${v.label}</h4>
          <div class="va-video-meta">
            <span>⏱ ${fmtTime(v.duration_s)}</span>
            <span>🚗 ${v.total_unique_tracks} tracks</span>
            <span>📐 ${v.source_resolution.width}×${v.source_resolution.height}</span>
          </div>
        </div>
      </div>
    `;
        })
        .join("");
}

// ── Detach all video event listeners (called before rebinding) ──
function detachVideoHandlers() {
    const v = VA.els.video;
    if (!v) return;
    const h = VA.handlers;
    if (h.loadedmetadata) v.removeEventListener("loadedmetadata", h.loadedmetadata);
    if (h.timeupdate) v.removeEventListener("timeupdate", h.timeupdate);
    if (h.play) v.removeEventListener("play", h.play);
    if (h.pause) v.removeEventListener("pause", h.pause);
    if (h.seeking) v.removeEventListener("seeking", h.seeking);
    if (h.seeked) v.removeEventListener("seeked", h.seeked);
    if (VA.els.seek && h.seekInput) VA.els.seek.removeEventListener("input", h.seekInput);
    if (VA.els.playBtn && h.playClick) VA.els.playBtn.removeEventListener("click", h.playClick);
    Object.keys(h).forEach((k) => { h[k] = null; });
}

// ── Select & load video ────────────────────────────────────────
async function selectVideo(videoId) {
    const myToken = ++VA.selectionToken;
    VA.selectedVideoId = videoId;
    const video = VA.manifest.videos.find((v) => v.id === videoId);
    if (!video) return;

    // highlight card
    document.querySelectorAll(".va-video-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.id === videoId);
    });

    // show player section
    VA.els.playerSection.style.display = "grid";

    // Stop any in-flight overlay before swapping the source
    stopVAOverlay();
    detachVideoHandlers();

    // load preview video
    VA.els.video.src = video.preview_path;
    VA.els.video.load();

    // load tracking data — bail out if a newer selection arrived
    try {
        const tracking = await vaFetch(`/api/video-tracking/${videoId}`);
        if (myToken !== VA.selectionToken) return; // stale
        VA.selectedTracking = tracking;
        // Cache sorted frame keys once for fast lookup
        VA.cachedFrameKeys = Object.keys(tracking.frames || {}).map(Number).sort((a, b) => a - b);
        await loadZonesForVideo(videoId);
    } catch (e) {
        if (myToken !== VA.selectionToken) return;
        VA.selectedTracking = null;
        VA.cachedFrameKeys = null;
        await loadZonesForVideo(videoId).catch(() => {});
        vaShowToast(`Tracking data unavailable for ${video.label}`, "warn");
    }

    if (myToken !== VA.selectionToken) return;

    // render events for this video
    renderEvents(video);

    // bind video events with named handlers (so we can remove them later)
    VA.handlers.loadedmetadata = () => {
        VA.els.seek.max = Math.floor(VA.els.video.duration);
        VA.els.timeLabel.textContent = `0:00 / ${fmtTime(VA.els.video.duration)}`;
    };
    VA.handlers.timeupdate = () => {
        VA.els.seek.value = Math.floor(VA.els.video.currentTime);
        VA.els.timeLabel.textContent = `${fmtTime(VA.els.video.currentTime)} / ${fmtTime(VA.els.video.duration)}`;
    };
    VA.handlers.seekInput = () => {
        const next = parseInt(VA.els.seek.value, 10);
        if (Number.isFinite(next)) VA.els.video.currentTime = next;
    };
    VA.handlers.seeking = () => {
        // While scrubbing, force overlay to redraw the latest frame even when paused
        VA.overlayDirty = true;
    };
    VA.handlers.seeked = () => {
        // Reset entry counts so they recount from the new position forward
        resetZoneEntryCounts();
        VA.overlayDirty = true;
    };
    VA.handlers.play = () => {
        VA.els.playBtn.textContent = "⏸ Pause";
    };
    VA.handlers.pause = () => {
        VA.els.playBtn.textContent = "▶ Play";
    };
    VA.handlers.playClick = () => {
        if (VA.els.video.paused) {
            VA.els.video.play().catch(() => {});
        } else {
            VA.els.video.pause();
        }
    };

    VA.els.video.addEventListener("loadedmetadata", VA.handlers.loadedmetadata);
    VA.els.video.addEventListener("timeupdate", VA.handlers.timeupdate);
    VA.els.video.addEventListener("play", VA.handlers.play);
    VA.els.video.addEventListener("pause", VA.handlers.pause);
    VA.els.video.addEventListener("seeking", VA.handlers.seeking);
    VA.els.video.addEventListener("seeked", VA.handlers.seeked);
    VA.els.seek.addEventListener("input", VA.handlers.seekInput);
    VA.els.playBtn.addEventListener("click", VA.handlers.playClick);

    VA.els.video.play().catch(() => { });
    VA.els.playBtn.textContent = "⏸ Pause";

    // overlay info
    VA.els.overlayInfo.textContent = `${video.label} | ${video.source_resolution.width}×${video.source_resolution.height}`;

    // start overlay loop
    startVAOverlay(video);

    // draw timeline chart
    drawTimelineChart(video);
}

// ── Detection overlay ──────────────────────────────────────────
function stopVAOverlay() {
    VA.overlayActive = false;
    if (VA.overlayRAF) {
        cancelAnimationFrame(VA.overlayRAF);
        VA.overlayRAF = null;
    }
}

// Binary search for nearest frame key (cached array)
function findClosestFrameKey(targetMs) {
    const keys = VA.cachedFrameKeys;
    if (!keys || keys.length === 0) return null;
    let lo = 0;
    let hi = keys.length - 1;
    if (targetMs <= keys[0]) return keys[0];
    if (targetMs >= keys[hi]) return keys[hi];
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (keys[mid] === targetMs) return keys[mid];
        if (keys[mid] < targetMs) lo = mid + 1;
        else hi = mid - 1;
    }
    // pick closer of keys[hi] (lower) and keys[lo] (upper)
    const lower = keys[hi];
    const upper = keys[lo];
    return (targetMs - lower) < (upper - targetMs) ? lower : upper;
}

function startVAOverlay(video) {
    stopVAOverlay();

    const canvas  = VA.els.canvas;
    const ctx     = canvas.getContext("2d");
    const videoEl = VA.els.video;
    let lastKey   = null;
    VA.overlayActive = true;
    VA.overlayDirty  = true;

    // If the tracking JSON has `infer_step`, the preview mp4 already has
    // baked-in YOLO boxes.  The canvas only draws interactive elements.
    const hasBakedOverlay = !!(VA.selectedTracking && VA.selectedTracking.infer_step != null);

    function isVATabActive() {
        const tab = document.getElementById("tab-video");
        return !!(tab && tab.classList.contains("active"));
    }

    function tick() {
        if (!VA.overlayActive) return;
        VA.overlayRAF = requestAnimationFrame(tick);
        if (!isVATabActive()) return;

        // ── Resize canvas to match CSS video size (DPR-aware) ──
        const rect = videoEl.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const targetW = Math.round(rect.width  * dpr);
        const targetH = Math.round(rect.height * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width  = targetW;
            canvas.height = targetH;
            canvas.style.width  = `${rect.width}px`;
            canvas.style.height = `${rect.height}px`;
            VA.overlayDirty = true;
        }

        const isPaused     = videoEl.paused;
        const currentTimeMs = Math.round(videoEl.currentTime * 1000);
        const closestKey   = findClosestFrameKey(currentTimeMs);

        // Skip redraw when paused and nothing changed
        if (isPaused && !VA.overlayDirty && lastKey === closestKey) return;
        lastKey = closestKey;
        VA.overlayDirty = false;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, rect.width, rect.height);
        drawVAZones(ctx, rect.width, rect.height);

        if (!VA.selectedTracking) return;
        const detections = closestKey != null
            ? (VA.selectedTracking.frames[String(closestKey)] || [])
            : [];

        // ── Position history update (every frame, even paused) ──
        if (closestKey != null) {
            updateTrackPositionHistory(detections);
        }
        // ── Zone entry counting (runs every unique frame) ─────
        if (closestKey != null && !videoEl.paused) {
            updateZoneEntryCounts(closestKey, detections);
        }

        // ── Live event banner (HTML element, not canvas) ──────
        const activeEvents = (video.events || []).filter(
            e => currentTimeMs >= e.start_ms && currentTimeMs <= e.end_ms
        );
        if (activeEvents.length > 0) {
            const ev      = activeEvents[0];
            const isCrash = ev.event_type === "incident_crash";
            if (VA.currentEventId !== ev.event_id) {
                VA.currentEventId = ev.event_id;
                VA.els.liveEventAlert.innerHTML = `
                  <div class="alert-content">
                    <span class="alert-icon">${isCrash ? "🚨" : "⚠️"}</span>
                    <div class="alert-text">
                      <h3 class="${isCrash ? "text-crash" : "text-warn"}">
                        ${eventTypeLabel(ev.event_type).toUpperCase()} DETECTED
                      </h3>
                      <p>${ev.description}</p>
                      <small>💡 ${ev.recommendation}</small>
                    </div>
                  </div>`;
                VA.els.liveEventAlert.style.display = "block";
                VA.els.liveEventAlert.classList.toggle("flash-alert", isCrash);
            }
        } else if (VA.currentEventId) {
            VA.els.liveEventAlert.style.display = "none";
            VA.currentEventId = null;
        }

        // ── HUD counts (HTML elements, no canvas drawing) ─────
        let vehicles = 0, peds = 0, stopped = 0, moving = 0;
        for (const d of detections) {
            if (d.class_name === "person") { peds++;    continue; }
            vehicles++;
            if (d.motion_state === "stopped") stopped++;
            else if (d.motion_state === "moving")  moving++;
        }
        VA.els.hudLeft.textContent  = `${vehicles} vehicles | ${peds} peds`;
        VA.els.overlayTime.textContent = fmtTime(videoEl.currentTime);
        VA.els.hudRight.textContent = `▶ ${moving} moving  ■ ${stopped} stopped`;

        if (hasBakedOverlay) {
            // Preview mp4 already has YOLO boxes drawn.
            // Canvas only adds a subtle stopped-vehicle pulse ring for emphasis.
            for (const det of detections) {
                if (det.motion_state !== "stopped") continue;
                const cx = (det.bbox_norm.x + det.bbox_norm.w / 2) * rect.width;
                const cy = (det.bbox_norm.y + det.bbox_norm.h / 2) * rect.height;
                const r  = Math.max(det.bbox_norm.w, det.bbox_norm.h) * rect.width * 0.55;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(243,87,87,0.45)";
                ctx.lineWidth   = 2.5;
                ctx.stroke();
            }
        } else {
            // Legacy / no-baked-overlay: draw full detection boxes on canvas
            ctx.font = "bold 11px Menlo, monospace";
            for (const det of detections) {
                const x  = det.bbox_norm.x * rect.width;
                const y  = det.bbox_norm.y * rect.height;
                const bw = det.bbox_norm.w * rect.width;
                const bh = det.bbox_norm.h * rect.height;
                const color = VA_CLASS_COLORS[det.class_name] || "#ffffff";

                // outer shadow for readability
                ctx.strokeStyle = "rgba(0,0,0,0.55)";
                ctx.lineWidth = 3.5;
                ctx.strokeRect(x, y, bw, bh);

                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, bw, bh);

                if (det.motion_state === "stopped") {
                    ctx.fillStyle = "rgba(243,87,87,0.75)";
                    ctx.fillRect(x, y, 7, 7);
                } else if (det.motion_state === "slow") {
                    ctx.fillStyle = "rgba(255,209,102,0.75)";
                    ctx.fillRect(x, y, 7, 7);
                }

                const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
                const tw    = ctx.measureText(label).width;
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.88;
                ctx.fillRect(x, y - 17, tw + 8, 17);
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = "#07111a";
                ctx.fillText(label, x + 4, y - 4);
            }
        }
    }

    tick();
}

// ── Zone editor ────────────────────────────────────────────────
function zoneApproaches(direction) {
    return {
        northbound: ["1", "2", "3"],
        southbound: ["4", "5", "6"],
        eastbound: ["7", "8", "9"],
        westbound: ["10", "11", "12", "13", "14"],
    }[direction] || [];
}

function setZoneMode(mode) {
    VA.zoneMode = mode;
    if (VA.els.zoneViewBtn) VA.els.zoneViewBtn.classList.toggle("active", mode === "view");
    if (VA.els.zoneDrawBtn) VA.els.zoneDrawBtn.classList.toggle("active", mode === "draw");
    // Toggle pointer-events: canvas must capture clicks in draw mode
    if (VA.els.canvas) VA.els.canvas.classList.toggle("zone-draw-active", mode === "draw");
    VA.overlayDirty = true;
}

async function loadZonesForVideo(videoId) {
    try {
        VA.zonePayload = await vaFetch(`/api/zones?video_id=${encodeURIComponent(videoId)}`);
        VA.zones = VA.zonePayload.zones || [];
        resetZoneEntryCounts();
        renderZoneList();
        VA.overlayDirty = true;
    } catch (err) {
        VA.zonePayload = null;
        VA.zones = [];
        resetZoneEntryCounts();
        renderZoneList();
        vaShowToast(`Zone definitions unavailable: ${err.message}`, "warn");
    }
}

function renderZoneList() {
    if (!VA.els.zoneList) return;
    const options = (VA.zones || [])
        .map((z) => `<option value="${z.zone_id}">${z.label || z.zone_id}</option>`)
        .join("");
    VA.els.zoneList.innerHTML = options || '<option value="">No zones</option>';
}

// Point-in-polygon test (ray casting)
function pointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > py) !== (yj > py)) &&
            (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// Point-near-segment test for 2-point line zones
function pointNearSegment(px, py, a, b, threshold = 0.025) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax, dy = by - ay;
    const segLenSq = dx * dx + dy * dy;
    if (segLenSq < 1e-12) {
        return Math.hypot(px - ax, py - ay) <= threshold;
    }
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segLenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) <= threshold;
}

// Returns true if point is "inside" a zone (polygon or line proximity)
function pointInZone(px, py, points_norm) {
    if (points_norm.length === 2) return pointNearSegment(px, py, points_norm[0], points_norm[1]);
    return pointInPolygon(px, py, points_norm);
}

function zonePolygonArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        area += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(area) / 2;
}

function zoneOrientation(a, b, c) {
    const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
}

function zoneSegmentsIntersect(a1, a2, b1, b2) {
    return zoneOrientation(a1, a2, b1) !== zoneOrientation(a1, a2, b2)
        && zoneOrientation(b1, b2, a1) !== zoneOrientation(b1, b2, a2);
}

function validateZoneDraft(points) {
    if (!Array.isArray(points) || points.length < 2) return "Zone requires at least two points.";
    if (points.length === 2) {
        if (Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) < 0.01) {
            return "Line zone is too short for reliable counting.";
        }
        return null;
    }
    if (zonePolygonArea(points) < 0.0001) return "Zone polygon is too small for reliable counting.";
    for (let i = 0; i < points.length; i++) {
        const a1 = points[i];
        const a2 = points[(i + 1) % points.length];
        for (let j = i + 1; j < points.length; j++) {
            if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1)) continue;
            if (zoneSegmentsIntersect(a1, a2, points[j], points[(j + 1) % points.length])) {
                return "Zone polygon lines cross each other.";
            }
        }
    }
    return null;
}

// Count detections (vehicles only) whose center falls inside a zone
function countDetectionsInZone(zone, detections) {
    if (!Array.isArray(zone.points_norm) || zone.points_norm.length < 2) return null;
    let count = 0;
    for (const det of detections) {
        if (det.class_name === "person") continue; // skip pedestrians
        const cx = det.bbox_norm.x + det.bbox_norm.w / 2;
        const cy = det.bbox_norm.y + det.bbox_norm.h / 2;
        if (pointInZone(cx, cy, zone.points_norm)) count++;
    }
    return count;
}

// ── Track position history ───────────────────────────────────────────────────
// Called every frame (including paused) to build movement history for direction detection
function updateTrackPositionHistory(detections) {
    const HIST_LEN = 20;
    for (const det of detections) {
        const trackId = String(det.track_id ?? "");
        if (!trackId || det.class_name === "person") continue;
        const cx = det.center_norm?.x ?? (det.bbox_norm.x + det.bbox_norm.w / 2);
        const cy = det.center_norm?.y ?? (det.bbox_norm.y + det.bbox_norm.h / 2);
        if (!VA.trackPositionHistory[trackId]) VA.trackPositionHistory[trackId] = [];
        const hist = VA.trackPositionHistory[trackId];
        hist.push({ x: cx, y: cy });
        if (hist.length > HIST_LEN) hist.shift();
    }
}

// Compute movement direction from position history.
// Returns "northbound" | "southbound" | "eastbound" | "westbound" | null
// Screen coords: y increases downward, x increases rightward
function computeTrackDirection(trackId) {
    const hist = VA.trackPositionHistory[trackId];
    if (!hist || hist.length < 4) return null;
    // Compare oldest vs newest for overall trajectory
    const oldest = hist[0];
    const newest = hist[hist.length - 1];
    const dx = newest.x - oldest.x;
    const dy = newest.y - oldest.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.012) return null; // not enough movement (< ~1.2% of frame)
    if (Math.abs(dy) >= Math.abs(dx)) {
        return dy < 0 ? "northbound" : "southbound";
    } else {
        return dx > 0 ? "eastbound" : "westbound";
    }
}

// Accumulate zone entry counts: fires once per unique track_id that enters a zone.
// When the zone has a direction filter, only counts vehicles moving in that direction.
function updateZoneEntryCounts(frameKey, detections) {
    if (VA._lastCountedFrameKey === frameKey) return; // already processed this frame
    VA._lastCountedFrameKey = frameKey;
    const zones = VA.zones || [];
    for (const zone of zones) {
        if (!Array.isArray(zone.points_norm) || zone.points_norm.length < 2) continue;
        if (!zone.enabled) continue;
        const zid = zone.zone_id;
        const zoneDirection = zone.direction || null;
        if (!VA.zoneEntryCounts[zid]) VA.zoneEntryCounts[zid] = 0;
        if (!VA.zonePrevOccupants[zid]) VA.zonePrevOccupants[zid] = new Set();
        const currentOccupants = new Set();
        for (const det of detections) {
            if (det.class_name === "person") continue;
            const trackId = String(det.track_id ?? "");
            if (!trackId) continue;
            const cx = det.bbox_norm.x + det.bbox_norm.w / 2;
            const cy = det.bbox_norm.y + det.bbox_norm.h / 2;
            if (pointInZone(cx, cy, zone.points_norm)) {
                currentOccupants.add(trackId);
                // New entrant: was not inside in previous frame
                if (!VA.zonePrevOccupants[zid].has(trackId)) {
                    // Direction filter: skip if zone has a direction AND
                    // we have enough history to determine direction AND it doesn't match
                    if (zoneDirection) {
                        const movDir = computeTrackDirection(trackId);
                        if (movDir !== null && movDir !== zoneDirection) continue;
                    }
                    VA.zoneEntryCounts[zid]++;
                }
            }
        }
        VA.zonePrevOccupants[zid] = currentOccupants;
    }
}

// Reset zone entry counters (call on video select, seek, or zone change)
function resetZoneEntryCounts() {
    VA.zoneEntryCounts = {};
    VA.zonePrevOccupants = {};
    VA._lastCountedFrameKey = null;
    VA.trackPositionHistory = {};
}

// Get current detections from the VA state
function getCurrentDetections() {
    if (!VA.selectedTracking) return [];
    const videoEl = VA.els?.video;
    if (!videoEl) return [];
    const currentMs = Math.round(videoEl.currentTime * 1000);
    const closestKey = findClosestFrameKey(currentMs);
    if (closestKey == null) return [];
    return VA.selectedTracking.frames[String(closestKey)] || [];
}

function drawVAZones(ctx, width, height) {
    const zones = VA.zones || [];
    const detections = getCurrentDetections();
    for (const zone of zones) {
        if (!zone.enabled || !Array.isArray(zone.points_norm) || zone.points_norm.length < 2) continue;

        const isLine = zone.is_line === true || zone.kind === "line_zone" || zone.points_norm.length === 2;

        // Build pixel-space path
        ctx.beginPath();
        zone.points_norm.forEach(([x, y], idx) => {
            const px = x * width, py = y * height;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        if (!isLine) ctx.closePath();

        // Fill & stroke
        const vehicleCount = countDetectionsInZone(zone, detections);
        const hasVehicles = vehicleCount != null && vehicleCount > 0;
        ctx.strokeStyle = zone.color || "#ffffff";
        ctx.lineWidth = hasVehicles ? 2.5 : 1.8;
        if (!isLine) {
            ctx.fillStyle = hasVehicles
                ? `${zone.color || "#ffffff"}50`
                : `${zone.color || "#ffffff"}22`;
            ctx.fill();
        }
        ctx.stroke();

        // Label + count badge
        const first = zone.points_norm[0];
        const label = zone.label || zone.zone_id;
        const lx = first[0] * width + 6;
        const ly = first[1] * height + 6;
        const badgeW = Math.min(220, 44 + label.length * 7);

        // Label background
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ly, badgeW, 20, 4);
        else ctx.rect(lx, ly, badgeW, 20);
        ctx.fill();
        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 11px Menlo, monospace";
        ctx.textAlign = "left";
        const dirArrow = { northbound: "↑", southbound: "↓", eastbound: "→", westbound: "←" };
        const dirLabel = zone.direction ? ` ${dirArrow[zone.direction] || ""}` : "";
        ctx.fillText(label + dirLabel, lx + 6, ly + 14);

        // ── Current occupancy badge (small circle, top-right of label) ──
        if (vehicleCount != null) {
            const bx = lx + badgeW + 8;
            const by = first[1] * height + 12;
            ctx.fillStyle = hasVehicles ? (zone.color || "#00e5ff") : "rgba(80,100,120,0.75)";
            ctx.beginPath();
            ctx.arc(bx, by, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = hasVehicles ? "#000" : "#ccc";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(vehicleCount), bx, by);
            ctx.textBaseline = "alphabetic";
            // small "now" label below
            ctx.font = "9px sans-serif";
            ctx.fillStyle = "rgba(200,220,240,0.8)";
            ctx.fillText("now", bx, by + 16);
        }

        // ── Cumulative entry count badge (larger, prominent) ──
        const entryCount = VA.zoneEntryCounts[zone.zone_id] ?? 0;
        {
            const ex = lx + badgeW + (vehicleCount != null ? 38 : 8);
            const ey = first[1] * height + 12;
            const hasEntries = entryCount > 0;
            // Outer glow ring when entries exist
            if (hasEntries) {
                ctx.beginPath();
                ctx.arc(ex, ey, 16, 0, Math.PI * 2);
                ctx.strokeStyle = `${zone.color || "#00e5ff"}66`;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            }
            ctx.fillStyle = hasEntries ? "#1a2a1a" : "rgba(30,45,60,0.85)";
            ctx.beginPath();
            ctx.arc(ex, ey, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = hasEntries ? (zone.color || "#62d0c3") : "rgba(120,150,170,0.8)";
            ctx.font = `bold ${entryCount > 99 ? "9" : "11"}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(entryCount > 999 ? "999+" : String(entryCount), ex, ey);
            ctx.textBaseline = "alphabetic";
            // "total" label below
            ctx.font = "9px sans-serif";
            ctx.fillStyle = hasEntries ? (zone.color || "#62d0c3") : "rgba(150,170,190,0.8)";
            ctx.fillText("total", ex, ey + 16);
        }
    }
    // Draw draft polygon
    if (VA.zoneDraft.length) {
        // Line from last placed point to mouse cursor
        const cx = VA._drawCursorX, cy = VA._drawCursorY;
        if (cx != null && VA.zoneDraft.length > 0) {
            const last = VA.zoneDraft[VA.zoneDraft.length - 1];
            ctx.beginPath();
            ctx.moveTo(last[0] * width, last[1] * height);
            ctx.lineTo(cx * width, cy * height);
            ctx.strokeStyle = "rgba(255,255,255,0.4)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Placed points + connecting lines
        ctx.beginPath();
        VA.zoneDraft.forEach(([x, y], idx) => {
            const px = x * width, py = y * height;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Point dots with number
        VA.zoneDraft.forEach(([x, y], idx) => {
            const px = x * width, py = y * height;
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "#00e5ff";
            ctx.fill();
            ctx.fillStyle = "#000";
            ctx.font = "bold 8px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(idx + 1, px, py);
            ctx.textBaseline = "alphabetic";
        });
    }

    // Draw mouse cursor indicator in draw mode
    if (VA.zoneMode === "draw" && VA._drawCursorX != null) {
        const mx = VA._drawCursorX * width;
        const my = VA._drawCursorY * height;
        const placed = VA.zoneDraft.length;
        const target = VA.zonePointTarget;
        const done = placed >= target;

        // Outer ring
        ctx.beginPath();
        ctx.arc(mx, my, 14, 0, Math.PI * 2);
        ctx.strokeStyle = done ? "rgba(34,197,94,0.7)" : "rgba(0,229,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Crosshair lines
        ctx.strokeStyle = done ? "rgba(34,197,94,0.9)" : "rgba(0,229,255,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx - 18, my); ctx.lineTo(mx - 8, my);
        ctx.moveTo(mx + 8, my); ctx.lineTo(mx + 18, my);
        ctx.moveTo(mx, my - 18); ctx.lineTo(mx, my - 8);
        ctx.moveTo(mx, my + 8); ctx.lineTo(mx, my + 18);
        ctx.stroke();
        // Counter badge
        if (!done) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.beginPath();
            ctx.arc(mx + 14, my - 14, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#00e5ff";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`${placed + 1}`, mx + 14, my - 14);
            ctx.textBaseline = "alphabetic";
        }
    }
}

function updateZoneDrawHint() {
    const hint = document.getElementById("va-zone-draw-hint");
    if (!hint) return;
    if (VA.zoneMode !== "draw") { hint.textContent = ""; return; }
    const placed = VA.zoneDraft.length;
    const target = VA.zonePointTarget;
    const remaining = target - placed;
    if (remaining > 0) {
        hint.textContent = `انقر على الفيديو لوضع نقطة (${placed}/${target} نقاط)`;
    } else {
        hint.textContent = `✅ تم وضع ${target} نقاط — اضغط Save Zone للحفظ`;
    }
}

function bindZoneEditor() {
    if (!VA.els.canvas) return;
    VA.els.zoneViewBtn?.addEventListener("click", () => { setZoneMode("view"); updateZoneDrawHint(); });
    VA.els.zoneDrawBtn?.addEventListener("click", () => {
        VA.zoneDraft = [];
        setZoneMode("draw");
        updateZoneDrawHint();
    });
    VA.els.zoneUndoBtn?.addEventListener("click", () => {
        VA.zoneDraft.pop();
        VA.overlayDirty = true;
        updateZoneDrawHint();
    });
    VA.els.zoneClearBtn?.addEventListener("click", () => {
        VA.zoneDraft = [];
        VA.overlayDirty = true;
        updateZoneDrawHint();
    });
    VA.els.zoneResetBtn?.addEventListener("click", resetZonesToDefaults);
    VA.els.zoneExportBtn?.addEventListener("click", exportCurrentZones);
    VA.els.zoneSaveBtn?.addEventListener("click", saveDraftZone);
    VA.els.zoneDeleteBtn?.addEventListener("click", deleteSelectedZone);

    // Point count selector
    const pointCountEl = document.getElementById("va-zone-point-count");
    if (pointCountEl) {
        pointCountEl.value = String(VA.zonePointTarget);
        pointCountEl.addEventListener("change", () => {
            VA.zonePointTarget = Math.max(2, Math.min(8, Number(pointCountEl.value) || 4));
            VA.zoneDraft = [];
            VA.overlayDirty = true;
            updateZoneDrawHint();
        });
    }

    VA.els.canvas.addEventListener("click", (event) => {
        if (VA.zoneMode !== "draw") return;
        const rect = VA.els.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        // If we already have enough points, ignore extra clicks
        if (VA.zoneDraft.length >= VA.zonePointTarget) return;
        const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        VA.zoneDraft.push([Number(x.toFixed(6)), Number(y.toFixed(6))]);
        VA.overlayDirty = true;
        updateZoneDrawHint();
        // Auto-close if target reached
        if (VA.zoneDraft.length >= VA.zonePointTarget) {
            vaShowToast(`${VA.zonePointTarget} نقاط جاهزة — اضغط Save Zone`, "info");
        }
    });

    // Canvas cursor feedback in draw mode
    VA.els.canvas.addEventListener("mousemove", (ev) => {
        if (VA.zoneMode !== "draw") return;
        const rect = VA.els.canvas.getBoundingClientRect();
        // Store normalized mouse position for the overlay tick to render
        VA._drawCursorX = (ev.clientX - rect.left) / rect.width;
        VA._drawCursorY = (ev.clientY - rect.top) / rect.height;
        VA.overlayDirty = true;
    });
    VA.els.canvas.addEventListener("mouseleave", () => {
        VA._drawCursorX = null;
        VA._drawCursorY = null;
        VA.overlayDirty = true;
    });
}

async function saveDraftZone() {
    if (!VA.selectedVideoId || VA.zoneDraft.length < VA.zonePointTarget || !VA.zonePayload?.document) {
        vaShowToast(`ضع ${VA.zonePointTarget} نقاط على الفيديو أولاً قبل الحفظ.`, "warn");
        return;
    }
    const draftError = validateZoneDraft(VA.zoneDraft);
    if (draftError) {
        vaShowToast(`Zone is unsafe: ${draftError}`, "error");
        return;
    }
    const documentPayload = structuredClone(VA.zonePayload.document);
    documentPayload.videos ||= {};
    documentPayload.videos[VA.selectedVideoId] ||= { label: VA.selectedVideoId, zones: [] };
    const direction = VA.els.zoneDirection?.value || null;
    const label = (VA.els.zoneLabel?.value || "").trim() || `Zone ${documentPayload.videos[VA.selectedVideoId].zones.length + 1}`;
    const isLineZone = VA.zoneDraft.length === 2;

    // Backend requires 3+ points — convert 2-point line to thin rectangle
    let pointsForBackend = VA.zoneDraft;
    if (isLineZone) {
        const [p1, p2] = VA.zoneDraft;
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 0.008;  // perpendicular offset
        const oy = (dx / len) * 0.008;
        pointsForBackend = [
            [+(p1[0] + ox).toFixed(6), +(p1[1] + oy).toFixed(6)],
            [+(p2[0] + ox).toFixed(6), +(p2[1] + oy).toFixed(6)],
            [+(p2[0] - ox).toFixed(6), +(p2[1] - oy).toFixed(6)],
            [+(p1[0] - ox).toFixed(6), +(p1[1] - oy).toFixed(6)],
        ];
    }

    documentPayload.videos[VA.selectedVideoId].zones.push({
        zone_id: `${VA.selectedVideoId}_${Date.now()}`,
        video_id: VA.selectedVideoId,
        label,
        kind: isLineZone ? "line_zone" : (direction ? "approach_entry" : "custom_zone"),
        direction,
        approach_ids: zoneApproaches(direction),
        points_norm: pointsForBackend,
        is_line: isLineZone,
        color: direction === "northbound" ? "#62d0c3" : direction === "southbound" ? "#ffb347" : direction === "eastbound" ? "#ffd166" : direction === "westbound" ? "#88c0fc" : "#ffffff",
        enabled: true,
        count_on_entry: true,
        render_order: 80 + documentPayload.videos[VA.selectedVideoId].zones.length,
    });
    const res = await fetch("/api/zones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentPayload),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        vaShowToast(`Zone save failed: HTTP ${res.status} — ${errText.match(/Message: ([^<]+)/)?.[1] || ""}`, "error");
        return;
    }
    VA.zoneDraft = [];
    await loadZonesForVideo(VA.selectedVideoId);  // resets counts internally
    setZoneMode("view");
    updateZoneDrawHint();
    vaShowToast("تم حفظ الـ Zone بنجاح ✅", "info");
}

async function resetZonesToDefaults() {
    if (!VA.selectedVideoId) return;
    const ok = window.confirm("Restore metadata default zones for this video?");
    if (!ok) return;
    const res = await fetch("/api/zones/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: VA.selectedVideoId }),
    });
    if (!res.ok) {
        vaShowToast(`Default reset failed: HTTP ${res.status}`, "error");
        return;
    }
    VA.zoneDraft = [];
    await loadZonesForVideo(VA.selectedVideoId);
    setZoneMode("view");
    updateZoneDrawHint();
    vaShowToast("Default zones restored.", "info");
}

async function exportCurrentZones() {
    const payload = {
        video_id: VA.selectedVideoId,
        exported_at: new Date().toISOString(),
        zones: VA.zones || [],
    };
    const python = `ZONE_DEFINITIONS = ${JSON.stringify(payload.zones, null, 2)}`;
    const text = `${JSON.stringify(payload, null, 2)}\n\n${python}\n`;
    try {
        await navigator.clipboard.writeText(text);
        vaShowToast("Zone definitions copied.", "info");
    } catch (err) {
        console.log(text);
        vaShowToast("Clipboard unavailable; zone definitions were written to console.", "warn");
    }
}

async function deleteSelectedZone() {
    const zoneId = VA.els.zoneList?.value;
    if (!zoneId) return;
    const res = await fetch(`/api/zones/${encodeURIComponent(zoneId)}`, { method: "DELETE" });
    if (!res.ok) {
        vaShowToast(`Zone delete failed: HTTP ${res.status}`, "error");
        return;
    }
    await loadZonesForVideo(VA.selectedVideoId || "*");
    vaShowToast("Zone deleted.", "info");
}

// ── Events panel ───────────────────────────────────────────────
function renderEvents(video) {
    const events = video.events || [];
    if (events.length === 0) {
        VA.els.eventsPanel.innerHTML =
            '<div style="padding:20px; color:#768e96; text-align:center;">No events detected in this clip.</div>';
        return;
    }

    VA.els.eventsPanel.innerHTML = events
        .map(
            (e, i) => `
    <div class="va-event-card" data-idx="${i}" onclick="vaSeekToEvent(${e.start_s})">
      <span class="ev-type ${e.severity}">${eventTypeLabel(e.event_type)} · ${e.severity.toUpperCase()}</span>
      <div class="ev-desc">${e.description}</div>
      <div class="ev-rec">💡 ${e.recommendation}</div>
      <div class="ev-time">${fmtTime(e.start_s)} – ${fmtTime(e.end_s)} · ${e.zone_label} · ${(e.confidence * 100).toFixed(0)}% conf</div>
    </div>
  `
        )
        .join("");
}

function vaSeekToEvent(startS) {
    if (VA.els.video) {
        VA.els.video.currentTime = startS;
        VA.els.video.play().catch(() => { });
        VA.els.playBtn.textContent = "⏸ Pause";
    }
}

// ── Use cases ──────────────────────────────────────────────────
function renderUseCases() {
    VA.els.useCases.innerHTML = VA.manifest.use_cases
        .map((uc) => {
            const evidenceIds = Array.isArray(uc.evidence_video_ids) ? uc.evidence_video_ids : [];
            const icon =
                {
                    object_detection_tracking: "🎯",
                    queue_monitoring: "🚦",
                    pedestrian_awareness: "🚶",
                    abnormal_stop_detection: "⚠️",
                    incident_workflow: "🚨",
                    heavy_vehicle_awareness: "🚛",
                }[uc.id] || "📊";
            return `
      <div class="va-uc-card ${uc.status}">
        <span class="va-uc-status">${uc.status === "proven" ? "✅ Proven" : "⚡ Supported"}</span>
        <h3>${icon} ${uc.title || uc.label || uc.id}</h3>
        <p>${uc.description || ""}</p>
        <div class="va-uc-evidence">${evidenceIds.length} video${evidenceIds.length !== 1 ? "s" : ""} · ${evidenceIds.join(", ")}</div>
      </div>`;
        })
        .join("");
}

// ── Incident banner ────────────────────────────────────────────
function renderIncidents() {
    const crashEvents = [];
    for (const v of VA.manifest.videos) {
        for (const e of v.events) {
            if (e.event_type === "incident_crash") {
                crashEvents.push({ ...e, videoLabel: v.label });
            }
        }
    }

    if (crashEvents.length === 0) {
        VA.els.incidents.innerHTML = "";
        return;
    }

    VA.els.incidents.innerHTML = crashEvents
        .map(
            (e) => `
    <div class="va-incident-banner">
      <div class="va-incident-icon">🚨</div>
      <div class="va-incident-body">
        <h3>Incident Alert — ${e.videoLabel}</h3>
        <p>${e.description}</p>
        <p><strong>Recommended Action:</strong> ${e.recommendation}</p>
        <small>Confidence: ${(e.confidence * 100).toFixed(0)}% · ${e.zone_label} · ${fmtTime(e.start_s)}–${fmtTime(e.end_s)}</small>
      </div>
    </div>`
        )
        .join("");
}

// ── Timeline mini chart ────────────────────────────────────────
function drawTimelineChart(video) {
    const canvas = VA.els.timelineCanvas;
    if (!canvas || !VA.selectedTracking) return;

    const stats = VA.selectedTracking.frame_stats || [];
    if (stats.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");
    const w = canvas.parentElement.clientWidth || 800;
    const h = 100;
    // High-DPI: internal canvas is dpr-scaled, CSS keeps logical size
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const maxVehicles = Math.max(...stats.map((s) => s.visible_vehicle_count), 1);
    const barW = Math.max(1, w / stats.length);

    for (let i = 0; i < stats.length; i++) {
        const s = stats[i];
        const barH = (s.visible_vehicle_count / maxVehicles) * (h - 20);
        const x = i * barW;
        const y = h - barH - 10;

        // bar color by motion ratio
        const ratio = s.visible_vehicle_count > 0 ? s.low_motion_vehicle_count / s.visible_vehicle_count : 0;
        if (ratio > 0.5) {
            ctx.fillStyle = "rgba(243,87,87,0.6)";
        } else if (ratio > 0.25) {
            ctx.fillStyle = "rgba(255,209,102,0.5)";
        } else {
            ctx.fillStyle = "rgba(98,208,195,0.4)";
        }

        ctx.fillRect(x, y, Math.max(barW - 1, 1), barH);

        // pedestrian dots
        if (s.person_count > 0) {
            ctx.fillStyle = "#88c0fc";
            ctx.beginPath();
            ctx.arc(x + barW / 2, h - 4, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // draw event markers
    const totalMs = stats[stats.length - 1].time_ms - stats[0].time_ms;
    for (const e of video.events) {
        const startFrac = (e.start_ms - stats[0].time_ms) / totalMs;
        const endFrac = (e.end_ms - stats[0].time_ms) / totalMs;
        const ex = startFrac * w;
        const ew = Math.max((endFrac - startFrac) * w, 3);
        ctx.fillStyle = e.severity === "high" ? "rgba(243,87,87,0.3)" : "rgba(255,209,102,0.2)";
        ctx.fillRect(ex, 0, ew, h);
    }

    // label
    ctx.fillStyle = "#768e96";
    ctx.font = "10px Menlo, monospace";
    ctx.fillText("Vehicle count over time", 6, 12);
    ctx.fillText(`Peak: ${maxVehicles}`, w - 80, 12);
}

// ── Tab switching ──────────────────────────────────────────────
let vaInitialized = false;

function activateVATab() {
    if (!vaInitialized) {
        vaInitialized = true;
        vaInit();
    } else if (VA.els && VA.els.liveEventAlert) {
        VA.els.liveEventAlert.style.opacity = "1";
        VA.els.liveEventAlert.style.pointerEvents = "auto";
    }
    // Resume overlay if a video is loaded
    if (VA.selectedVideoId && !VA.overlayActive) {
        const video = VA.manifest && VA.manifest.videos.find((v) => v.id === VA.selectedVideoId);
        if (video) startVAOverlay(video);
    }
}

function deactivateVATab() {
    // Pause video and stop the RAF loop to free CPU and prevent leaks
    if (VA.els && VA.els.video && !VA.els.video.paused) {
        VA.els.video.pause();
        if (VA.els.playBtn) VA.els.playBtn.textContent = "▶ Play";
    }
    stopVAOverlay();
    if (VA.els && VA.els.liveEventAlert) {
        VA.els.liveEventAlert.style.display = "none";
        VA.els.liveEventAlert.style.opacity = "0";
    }
    VA.currentEventId = null;
}

document.addEventListener("DOMContentLoaded", () => {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;

            if (target === "tab-video") {
                activateVATab();
            } else {
                deactivateVATab();
            }
        });
    });

    // Pause overlay loop when the page is hidden
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopVAOverlay();
            if (VA.els && VA.els.video && !VA.els.video.paused) {
                VA.els.video.pause();
                if (VA.els.playBtn) VA.els.playBtn.textContent = "▶ Play";
            }
        } else {
            const tab = document.getElementById("tab-video");
            if (tab && tab.classList.contains("active") && VA.selectedVideoId && !VA.overlayActive) {
                const video = VA.manifest && VA.manifest.videos.find((v) => v.id === VA.selectedVideoId);
                if (video) startVAOverlay(video);
            }
        }
    });
});
