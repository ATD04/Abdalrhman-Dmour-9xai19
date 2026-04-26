/* ═══════════════════════════════════════════════════════════════
   VIDEO ANALYTICS TAB – Wadi Saqra Traffic Control Room
   Full front-end logic: gallery, player, overlay, events, KPIs
   ═══════════════════════════════════════════════════════════════ */

const VA = {
    manifest: null,
    selectedVideoId: null,
    selectedTracking: null,
    overlayRAF: null,
    els: {},
};

const VA_CLASS_COLORS = {
    car: "#62d0c3",
    truck: "#ffb347",
    bus: "#ffd166",
    motorcycle: "#f39ae0",
    person: "#88c0fc",
};

// ── Utilities ──────────────────────────────────────────────────
function vaFetch(url) {
    return fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
    });
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
      <small>@ ${VA.manifest.sample_fps} FPS sample</small>
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

// ── Select & load video ────────────────────────────────────────
async function selectVideo(videoId) {
    VA.selectedVideoId = videoId;
    const video = VA.manifest.videos.find((v) => v.id === videoId);
    if (!video) return;

    // highlight card
    document.querySelectorAll(".va-video-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.id === videoId);
    });

    // show player section
    VA.els.playerSection.style.display = "grid";

    // load preview video
    VA.els.video.src = video.preview_path;
    VA.els.video.load();

    // load tracking data
    try {
        VA.selectedTracking = await vaFetch(`/api/video-tracking/${videoId}`);
    } catch (e) {
        VA.selectedTracking = null;
    }

    // render events for this video
    renderEvents(video);

    // bind video events
    VA.els.video.onloadedmetadata = () => {
        VA.els.seek.max = Math.floor(VA.els.video.duration);
        VA.els.timeLabel.textContent = `0:00 / ${fmtTime(VA.els.video.duration)}`;
    };

    VA.els.video.ontimeupdate = () => {
        VA.els.seek.value = Math.floor(VA.els.video.currentTime);
        VA.els.timeLabel.textContent = `${fmtTime(VA.els.video.currentTime)} / ${fmtTime(VA.els.video.duration)}`;
    };

    VA.els.seek.oninput = () => {
        VA.els.video.currentTime = parseInt(VA.els.seek.value);
    };

    VA.els.playBtn.onclick = () => {
        if (VA.els.video.paused) {
            VA.els.video.play();
            VA.els.playBtn.textContent = "⏸ Pause";
        } else {
            VA.els.video.pause();
            VA.els.playBtn.textContent = "▶ Play";
        }
    };

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
function startVAOverlay(video) {
    if (VA.overlayRAF) cancelAnimationFrame(VA.overlayRAF);

    const canvas = VA.els.canvas;
    const ctx = canvas.getContext("2d");
    const videoEl = VA.els.video;

    function tick() {
        VA.overlayRAF = requestAnimationFrame(tick);

        const rect = videoEl.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!VA.selectedTracking || videoEl.paused && videoEl.currentTime === 0) return;

        const fps = VA.selectedTracking.fps || 2;
        const currentTimeMs = Math.round(videoEl.currentTime * 1000);
        // find closest frame
        const frameKeys = Object.keys(VA.selectedTracking.frames).map(Number).sort((a, b) => a - b);
        let closestKey = frameKeys[0];
        for (const k of frameKeys) {
            if (Math.abs(k - currentTimeMs) < Math.abs(closestKey - currentTimeMs)) {
                closestKey = k;
            }
            if (k > currentTimeMs) break;
        }

        const detections = VA.selectedTracking.frames[String(closestKey)] || [];

        // Check for active live events
        const isVATabActive = document.getElementById("va-tab") && document.getElementById("va-tab").classList.contains("active");
        
        const activeEvents = (video.events || []).filter(e => 
            currentTimeMs >= e.start_ms && currentTimeMs <= e.end_ms
        );

        if (activeEvents.length > 0 && isVATabActive) {
            const currentEvent = activeEvents[0];
            const isCrash = currentEvent.event_type === "incident_crash";
            if (VA.currentEventId !== currentEvent.event_id) {
                VA.currentEventId = currentEvent.event_id;
                VA.els.liveEventAlert.innerHTML = `
                    <div class="alert-content">
                        <span class="alert-icon">${isCrash ? '🚨' : '⚠️'}</span>
                        <div class="alert-text">
                            <h3 class="${isCrash ? 'text-crash' : 'text-warn'}">
                                ${eventTypeLabel(currentEvent.event_type).toUpperCase()} DETECTED
                            </h3>
                            <p>${currentEvent.description}</p>
                            <small>💡 ${currentEvent.recommendation}</small>
                        </div>
                    </div>
                `;
                VA.els.liveEventAlert.style.display = "block";
                if (isCrash) {
                    VA.els.liveEventAlert.classList.add("flash-alert");
                } else {
                    VA.els.liveEventAlert.classList.remove("flash-alert");
                }
            }
        } else {
            if (VA.currentEventId) {
                VA.els.liveEventAlert.style.display = "none";
                VA.currentEventId = null;
            }
        }

        // Update HUD
        const vehicles = detections.filter((d) => d.class_name !== "person").length;
        const peds = detections.filter((d) => d.class_name === "person").length;
        VA.els.hudLeft.textContent = `${vehicles} vehicles | ${peds} pedestrians`;
        VA.els.overlayTime.textContent = fmtTime(videoEl.currentTime);

        // Count by motion state
        const stopped = detections.filter((d) => d.motion_state === "stopped" && d.class_name !== "person").length;
        const moving = detections.filter((d) => d.motion_state === "moving" && d.class_name !== "person").length;
        VA.els.hudRight.textContent = `▶ ${moving} moving | ■ ${stopped} stopped`;

        // Draw detections
        for (const det of detections) {
            const x = det.bbox_norm.x * canvas.width;
            const y = det.bbox_norm.y * canvas.height;
            const w = det.bbox_norm.w * canvas.width;
            const h = det.bbox_norm.h * canvas.height;
            const color = VA_CLASS_COLORS[det.class_name] || "#ffffff";

            // bbox
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);

            // motion dot
            if (det.motion_state === "stopped") {
                ctx.fillStyle = "rgba(243,87,87,0.7)";
                ctx.fillRect(x, y, 6, 6);
            } else if (det.motion_state === "slow") {
                ctx.fillStyle = "rgba(255,209,102,0.7)";
                ctx.fillRect(x, y, 6, 6);
            }

            // label bg
            const label = `${det.class_name} ${(det.confidence * 100).toFixed(0)}%`;
            ctx.font = "bold 11px Menlo, monospace";
            const textW = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(x, y - 16, textW + 8, 16);
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = "#0e1e25";
            ctx.fillText(label, x + 4, y - 4);
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

    const ctx = canvas.getContext("2d");
    const w = canvas.parentElement.clientWidth || 800;
    const h = 100;
    canvas.width = w;
    canvas.height = h;
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
                if (!vaInitialized) {
                    vaInitialized = true;
                    vaInit();
                }
                if (VA.els && VA.els.liveEventAlert) {
                    VA.els.liveEventAlert.style.opacity = "1";
                    VA.els.liveEventAlert.style.pointerEvents = "auto";
                }
            } else {
                // Pause video if switching away from VA tab
                if (VA.els && VA.els.video && !VA.els.video.paused) {
                    VA.els.video.pause();
                    if (VA.els.playBtn) VA.els.playBtn.textContent = "▶ Play";
                }
                // Strictly enforce hiding the notification
                if (VA.els && VA.els.liveEventAlert) {
                    VA.els.liveEventAlert.style.display = "none";
                    VA.els.liveEventAlert.style.opacity = "0";
                    VA.currentEventId = null;
                }
            }
        });
    });
});
