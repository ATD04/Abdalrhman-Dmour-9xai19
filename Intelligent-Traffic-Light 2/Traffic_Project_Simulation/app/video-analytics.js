// ── Camera Vehicle Count Logic (top-level) ─────────────────────────────
const VA_VEHICLE_CLASSES = ["car", "bus", "truck", "motorcycle"];
let vaCameraCountState = {
    uniqueIds: new Set(),
    idFrameCounts: {},
    idClass: {},
    idMotion: {},
    idLastSeen: {},
    idDirection: {},
    classBreakdown: {car:0, bus:0, truck:0, motorcycle:0},
    moving: 0,
    stopped: 0,
    currentVisible: 0,
    confidence: "Low",
    lastVideoId: null,
};

function resetCameraCountState(videoId) {
    vaCameraCountState = {
        uniqueIds: new Set(),
        idFrameCounts: {},
        idClass: {},
        idMotion: {},
        idLastSeen: {},
        idDirection: {},
        classBreakdown: {car:0, bus:0, truck:0, motorcycle:0},
        moving: 0,
        stopped: 0,
        currentVisible: 0,
        confidence: "Low",
        lastVideoId: videoId,
    };
}

function updateCameraVehicleCount(currentDetections, videoId, frameIdx) {
    if (vaCameraCountState.lastVideoId !== videoId) resetCameraCountState(videoId);
    const minFrames = 3;
    const now = Date.now();
    // Track per-frame — every visible vehicle is either moving or stopped (always sums correctly)
    let visible = 0, moving = 0, stopped = 0;
    let classCounts = {car:0, bus:0, truck:0, motorcycle:0};
    for (const det of currentDetections) {
        if (!VA_VEHICLE_CLASSES.includes(det.class_name)) continue;
        if (!det.track_id) continue;
        if (det.confidence !== undefined && det.confidence < 0.30) continue;
        visible++;
        classCounts[det.class_name]++;
        // Treat anything that isn't explicitly "moving" as stopped so counts always sum to visible
        if (det.motion_state === "moving") moving++;
        else stopped++;
        vaCameraCountState.idFrameCounts[det.track_id] = (vaCameraCountState.idFrameCounts[det.track_id] || 0) + 1;
        vaCameraCountState.idClass[det.track_id] = det.class_name;
        vaCameraCountState.idMotion[det.track_id] = det.motion_state;
        vaCameraCountState.idLastSeen[det.track_id] = now;
        if (vaCameraCountState.idFrameCounts[det.track_id] >= minFrames) {
            vaCameraCountState.uniqueIds.add(det.track_id);
        }
    }
    // Prune IDs not seen for >3s
    for (const id in vaCameraCountState.idLastSeen) {
        if (now - vaCameraCountState.idLastSeen[id] > 3000) {
            delete vaCameraCountState.idLastSeen[id];
            delete vaCameraCountState.idFrameCounts[id];
        }
    }
    vaCameraCountState.currentVisible = visible;
    vaCameraCountState.moving  = moving;
    vaCameraCountState.stopped = stopped;
    vaCameraCountState.classBreakdown = classCounts;
    // Confidence: based on how many unique tracks have been confirmed (≥minFrames)
    const uniq = vaCameraCountState.uniqueIds.size;
    if (uniq > 15 && visible > 0) vaCameraCountState.confidence = "High";
    else if (uniq > 5) vaCameraCountState.confidence = "Medium";
    else if (uniq > 3) vaCameraCountState.confidence = "Medium";
    else vaCameraCountState.confidence = "Low";
    renderCameraVehicleCount();
}

function renderCameraVehicleCount() {
    const s = vaCameraCountState;
    const get = id => document.getElementById(id);
    if (!get("va-cc-current")) return;
    get("va-cc-current").textContent = s.currentVisible;
    get("va-cc-unique").textContent = s.uniqueIds.size;
    get("va-cc-moving").textContent = s.moving;
    get("va-cc-stopped").textContent = s.stopped;
    get("va-cc-cars").textContent = s.classBreakdown.car;
    get("va-cc-buses").textContent = s.classBreakdown.bus;
    get("va-cc-trucks").textContent = s.classBreakdown.truck;
    get("va-cc-motorcycles").textContent = s.classBreakdown.motorcycle;
    get("va-cc-confidence").textContent = s.confidence;
}

// ── Signal Intelligence ────────────────────────────────────────
// Zone convention (from build script):
//   north_approach = top-right area  → vehicles traveling SOUTH (from north)
//   south_approach = bottom area     → vehicles traveling NORTH (from south)
//   east_approach  = right area      → vehicles traveling WEST  (from east)
//   west_approach  = left area       → vehicles traveling EAST  (from west)
// Signal naming: by the APPROACH SIDE (north signal = signal at north leg)
const ZONE_TO_APPROACH = {
    north_approach: "north",
    south_approach: "south",
    east_approach:  "east",
    west_approach:  "west",
};

// ── 3-Phase signal model ────────────────────────────────────────
// Phase "ns" : North + South GREEN simultaneously (same road axis, opposing traffic)
// Phase "e"  : East GREEN only  (cars from east_approach, travelling west)
// Phase "w"  : West GREEN only  (cars from west_approach, travelling east)
// East and West are NEVER green at the same time.
// ────────────────────────────────────────────────────────────────
const VA_SIGNAL = {
    buffer:        [],
    BUFFER_SIZE:   30,          // ~2 s at 15 fps
    phase:         "ns",        // "ns" | "e" | "w"
    phaseTimer:    0,
    YELLOW_FRAMES: 10,          // frames of all-yellow before switching
    HYSTERESIS:    1.5,         // challenger must be 1.5× current to trigger switch
    state:  { north: "green", south: "green", east: "red",  west: "red"  },
    moving: { north: 0, south: 0, east: 0, west: 0 },
    total:  { north: 0, south: 0, east: 0, west: 0 },
};

function inferSignalStates(detections) {
    // ── 1. Tally moving + total vehicles per approach ────────────
    const moving = { north: 0, south: 0, east: 0, west: 0 };
    const total  = { north: 0, south: 0, east: 0, west: 0 };

    for (const det of detections) {
        if (det.class_name === "person") continue;
        const approach = ZONE_TO_APPROACH[det.zone];
        if (!approach) continue;
        total[approach]++;
        if (det.motion_state === "moving") moving[approach]++;
    }
    VA_SIGNAL.moving = moving;
    VA_SIGNAL.total  = total;

    // ── 2. Push per-phase demand into rolling buffer ─────────────
    // NS demand = north + south moving (they share one road axis)
    // E demand  = east moving  (independent leg)
    // W demand  = west moving  (independent leg)
    const ns = moving.north + moving.south;
    const e  = moving.east;
    const w  = moving.west;

    VA_SIGNAL.buffer.push({ ns, e, w });
    if (VA_SIGNAL.buffer.length > VA_SIGNAL.BUFFER_SIZE) VA_SIGNAL.buffer.shift();

    // ── 3. Linearly-weighted rolling average (recent = heavier) ──
    let wNs = 0, wE = 0, wW = 0, wSum = 0;
    VA_SIGNAL.buffer.forEach((b, i) => {
        const weight = i + 1;   // oldest frame = weight 1, newest = BUFFER_SIZE
        wNs  += b.ns * weight;
        wE   += b.e  * weight;
        wW   += b.w  * weight;
        wSum += weight;
    });
    const avgNs = wNs / wSum;
    const avgE  = wE  / wSum;
    const avgW  = wW  / wSum;

    // ── 4. Demand-responsive phase selection with hysteresis ─────
    // Only switch when the challenger is HYSTERESIS× busier than the current phase
    let newPhase = VA_SIGNAL.phase;
    const H = VA_SIGNAL.HYSTERESIS;

    if (VA_SIGNAL.phase === "ns") {
        // Switch to E only if E clearly beats both NS and W
        if (avgE > avgNs * H && avgE >= avgW) newPhase = "e";
        // Switch to W only if W clearly beats both NS and E
        else if (avgW > avgNs * H && avgW > avgE) newPhase = "w";
    } else if (VA_SIGNAL.phase === "e") {
        if (avgNs > avgE * H)            newPhase = "ns";
        else if (avgW > avgE * H)        newPhase = "w";
    } else { // "w"
        if (avgNs > avgW * H)            newPhase = "ns";
        else if (avgE > avgW * H)        newPhase = "e";
    }

    // ── 5. Apply YELLOW transition on every phase change ─────────
    if (newPhase !== VA_SIGNAL.phase) {
        VA_SIGNAL.phase      = newPhase;
        VA_SIGNAL.phaseTimer = VA_SIGNAL.YELLOW_FRAMES;
    }

    // ── 6. Set signal state — only ONE direction (or NS pair) is green ──
    if (VA_SIGNAL.phaseTimer > 0) {
        VA_SIGNAL.phaseTimer--;
        VA_SIGNAL.state = { north: "yellow", south: "yellow", east: "yellow", west: "yellow" };
    } else if (VA_SIGNAL.phase === "ns") {
        VA_SIGNAL.state = { north: "green", south: "green", east: "red",   west: "red"   };
    } else if (VA_SIGNAL.phase === "e") {
        VA_SIGNAL.state = { north: "red",   south: "red",   east: "green", west: "red"   };
    } else { // "w"
        VA_SIGNAL.state = { north: "red",   south: "red",   east: "red",   west: "green" };
    }
}

function renderSignalPanel() {
    const DIRS  = ["north", "south", "east", "west"];
    const ABBR  = { north: "n", south: "s", east: "e", west: "w" };
    const state = VA_SIGNAL.state;
    const mov   = VA_SIGNAL.moving;
    const tot   = VA_SIGNAL.total;

    DIRS.forEach(dir => {
        const a   = ABBR[dir];
        const col = state[dir]; // "red" | "yellow" | "green"

        // count label
        const cntEl = document.getElementById(`va-sigcount-${dir}`);
        if (cntEl) {
            const pct = tot[dir] > 0 ? Math.round((mov[dir] / tot[dir]) * 100) : 0;
            cntEl.textContent = `${tot[dir]} veh · ${pct}% moving`;
        }

        // lights: r=red, y=yellow, g=green
        const colorMap = { r: "red", y: "yellow", g: "green" };
        ["r", "y", "g"].forEach(c => {
            const el = document.getElementById(`va-sigl-${a}-${c}`);
            if (!el) return;
            const lightColor = colorMap[c];
            const active = col === lightColor;
            el.className = `va-sig-light va-sig-${lightColor} ${active ? "va-sig-active" : "va-sig-dim"}`;
        });
    });

    renderDirectionFlow();
}

function renderDirectionFlow() {
    const el = document.getElementById("va-direction-flow");
    if (!el) return;
    const state  = VA_SIGNAL.state;
    const mov    = VA_SIGNAL.moving;
    const tot    = VA_SIGNAL.total;
    const maxTot = Math.max(...Object.values(tot), 1);

    const ARROWS   = { north: "↑", south: "↓", east: "→", west: "←" };
    const LABELS   = { north: "Going North", south: "Going South", east: "Going East", west: "Going West" };
    const LABELS_AR = { north: "شمال", south: "جنوب", east: "شرق", west: "غرب" };
    const SIG_COLOR = { red: "#FF1744", yellow: "#FFD740", green: "#00E676" };

    el.innerHTML = ["north", "south", "east", "west"].map(dir => {
        const cnt  = tot[dir];
        const m    = mov[dir];
        const pct  = ((cnt / maxTot) * 100).toFixed(1);
        const col  = state[dir];
        const fill = SIG_COLOR[col] || "#6B8CAE";
        return `
        <div class="va-dirflow-row">
          <span class="va-dirflow-arrow">${ARROWS[dir]}</span>
          <span class="va-dirflow-label">${LABELS[dir]} <span class="va-dirflow-ar">${LABELS_AR[dir]}</span></span>
          <div class="va-dirflow-bar-wrap">
            <div class="va-dirflow-bar-fill" style="width:${pct}%;background:${fill}"></div>
          </div>
          <span class="va-dir-sig-dot" style="background:${fill};box-shadow:0 0 6px ${fill}88"></span>
          <span class="va-dirflow-count">${cnt} veh</span>
          <span class="va-dirflow-moving" style="color:${col==='green'?'#00E676':col==='yellow'?'#FFD740':'#FF174499'}">${m} ▶</span>
        </div>`;
    }).join("");
}
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
    };

    VA.els.liveEventAlert = document.createElement("div");
    VA.els.liveEventAlert.className = "va-live-event-alert";
    VA.els.liveEventAlert.style.display = "none";
    document.getElementById("va-tab").appendChild(VA.els.liveEventAlert);

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

    // show intel panel and reset signal state
    const intelPanel = document.getElementById("va-intel-panel");
    if (intelPanel) intelPanel.style.display = "flex";
    VA_SIGNAL.buffer       = [];
    VA_SIGNAL.phase        = "ns";
    VA_SIGNAL.phaseTimer   = 0;
    VA_SIGNAL.state  = { north: "green", south: "green", east: "red",   west: "red"   };
    VA_SIGNAL.moving = { north: 0, south: 0, east: 0, west: 0 };
    VA_SIGNAL.total  = { north: 0, south: 0, east: 0, west: 0 };

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
    } catch (e) {
        if (myToken !== VA.selectionToken) return;
        VA.selectedTracking = null;
        VA.cachedFrameKeys = null;
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
        const tab = document.getElementById("va-tab");
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

        if (!VA.selectedTracking) return;
        const detections = closestKey != null
            ? (VA.selectedTracking.frames[String(closestKey)] || [])
            : [];

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

        // ── Camera vehicle count update (ensure every frame) ─────
        if (VA.selectedVideoId && Array.isArray(detections)) {
            updateCameraVehicleCount(detections, VA.selectedVideoId, closestKey);
        }

        // Live signal inference & panel update
        inferSignalStates(detections);
        renderSignalPanel();

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
        <h3>${icon} ${uc.title}</h3>
        <p>${uc.description}</p>
        <div class="va-uc-evidence">${uc.evidence_video_ids.length} video${uc.evidence_video_ids.length !== 1 ? "s" : ""} · ${uc.evidence_video_ids.join(", ")}</div>
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
    const tabBtns = document.querySelectorAll(".main-tab-btn");
    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            const target = btn.dataset.tab;
            tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
            document.querySelectorAll(".tab-content").forEach((tc) => {
                tc.classList.toggle("active", tc.id === target);
            });

            if (target === "va-tab") {
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
            const tab = document.getElementById("va-tab");
            if (tab && tab.classList.contains("active") && VA.selectedVideoId && !VA.overlayActive) {
                const video = VA.manifest && VA.manifest.videos.find((v) => v.id === VA.selectedVideoId);
                if (video) startVAOverlay(video);
            }
        }
    });
});
