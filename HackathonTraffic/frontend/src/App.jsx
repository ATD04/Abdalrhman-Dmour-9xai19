import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Activity, AlertTriangle, AlertCircle, Info, MapPin, Navigation, Signal, ShieldCheck, PlayCircle, Clock, Maximize2, Layers, Cpu, ScanText, Monitor, Boxes
} from 'lucide-react';

const App = () => {
  const [siteInfo, setSiteInfo] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [spatialAnns, setSpatialAnns] = useState([]);
  const [streamIntel, setStreamIntel] = useState(null);
  const [signalLogs, setSignalLogs] = useState([]);
  const [currentSignals, setCurrentSignals] = useState({"1": "RED", "2": "RED", "3": "RED", "4": "RED"});
  const [currentLanes, setCurrentLanes] = useState({});
  const [activeDetections, setActiveDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [currentVideoData, setCurrentVideoData] = useState(null);
  const [cumulativeCount, setCumulativeCount] = useState(0);
  const cumulativeIdsRef = useRef(new Set());
  const videoRef = useRef(null);
  const requestRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, trafficRes, signalRes, incidentRes, clipsRes, spatialRes, streamRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/site-info'),
          fetch('http://localhost:8000/api/v1/traffic-stats'),
          fetch('http://localhost:8000/api/v1/signal-status'),
          fetch('http://localhost:8000/api/v1/incidents'),
          fetch('http://localhost:8000/api/v1/clips'),
          fetch('http://localhost:8000/api/v1/spatial-annotations'),
          fetch('http://localhost:8000/api/v1/stream-detections')
        ]);

        const info = await infoRes.json();
        const traffic = await trafficRes.json();
        const signals = await signalRes.json();
        const incidentList = await incidentRes.json();
        const clipList = await clipsRes.json();
        const spatialData = await spatialRes.json();
        const streamData = await streamRes.json();

        setSiteInfo(info);
        setTrafficData(traffic);
        setSignalLogs(signals);
        setIncidents(incidentList);
        setSpatialAnns(spatialData);
        setStreamIntel(streamData);
        
        if (clipList.clips && clipList.clips.length > 0) {
          const firstClip = clipList.clips[0];
          setCurrentVideo(`http://localhost:8000/video/${firstClip.source_video}`);
          setCurrentVideoData(firstClip);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching sandbox data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const syncDetections = () => {
    if (videoRef.current) {
      const currentTime_sec = videoRef.current.currentTime;
      
      // 1. Detections Sync
      if (streamIntel?.frames) {
        const fps = streamIntel.metadata.fps || 30;
        const totalFrames = streamIntel.metadata.total_frames || 0;
        const frameId = Math.floor(currentTime_sec * fps);
        
        // LOOP CONTROL: If video plays past our available annotations, restart it
        if (totalFrames > 0 && frameId >= totalFrames - 1) {
          videoRef.current.currentTime = 0;
          requestRef.current = requestAnimationFrame(syncDetections);
          return;
        }

        const detections = streamIntel.frames[frameId] || [];
        setActiveDetections(detections);
        
        // Update cumulative count using ref for persistence
        let updated = false;
        detections.forEach(d => {
          if (!cumulativeIdsRef.current.has(d.id)) {
            cumulativeIdsRef.current.add(d.id);
            updated = true;
          }
        });
        if (updated) setCumulativeCount(cumulativeIdsRef.current.size);
      }

      // 2. Simulation Sync (HH:MM:SS)
      let offset_sec = 0;
      if (currentVideoData?.start_time) {
        offset_sec = parseTimestamp(currentVideoData.start_time);
      }
      
      const total_sec = offset_sec + currentTime_sec;
      const h = Math.floor(total_sec / 3600) % 24;
      const m = Math.floor((total_sec % 3600) / 60);
      const s = Math.floor(total_sec % 60);
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      const shortTimeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

      // Signals
      const relevantLogs = signalLogs.filter(log => {
        const logTime = log.timestamp.split(' ')[1]; 
        return logTime <= timeStr;
      });
      
      if (relevantLogs.length > 0) {
        const latestState = {};
        relevantLogs.forEach(log => {
          latestState[String(log.phase_number)] = log.signal_state.split(' ')[0];
        });
        setCurrentSignals(prev => ({...prev, ...latestState}));
      }

      // Lane Grid
      const trafficEntry = trafficData.find(d => d.time === shortTimeStr);
      if (trafficEntry) {
        // If trafficEntry has lane data, set it
        if (trafficEntry.lanes) setCurrentLanes(trafficEntry.lanes);
      }
    }
    requestRef.current = requestAnimationFrame(syncDetections);
  };

  useEffect(() => {
    if (!loading && streamIntel) {
      requestRef.current = requestAnimationFrame(syncDetections);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [loading, streamIntel, signalLogs, trafficData, activeTab]);

  const parseTimestamp = (timeStr) => {
    const [hh, mm, ss] = timeStr.split(':').map(Number);
    return hh * 3600 + mm * 60 + ss;
  };

  const handleIncidentClick = (incident) => {
    setActiveTab('live');
    setActiveIncident(incident);
    setCurrentVideoData(incident);
    const videoUrl = incident.video_file.startsWith('raw/') 
      ? `http://localhost:8000/video/${incident.video_file}`
      : `http://localhost:8000/video/raw/${incident.video_file}`;

    if (currentVideo !== videoUrl) {
      setCurrentVideo(videoUrl);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.currentTime = parseTimestamp(incident.start_time);
          videoRef.current.play();
        }
      }, 500);
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = parseTimestamp(incident.start_time);
        videoRef.current.play();
      }
    }
  };

  const getLabelColor = (label) => {
    switch (label.toLowerCase()) {
      case 'car': return '#3b82f6'; // Blue
      case 'bus': return '#10b981'; // Emerald
      case 'truck': return '#f59e0b'; // Amber
      case 'motorcycle': return '#8b5cf6'; // Purple
      default: return '#64748b';
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-pulse text-blue-400 font-mono text-xl flex items-center gap-4">
        <Cpu className="animate-spin" /> SYNCHRONIZING REAL-TIME INTELLIGENCE...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header */}
      <header className="flex justify-between items-center mb-8 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
            <ShieldCheck className="text-blue-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">Traffic Intelligence Sandbox Monitor</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              NODE: AMM-WS-01 (WADI SAQRA) | SANDBOX_PREVIEW_MODE: ACTIVE
            </div>
          </div>
        </div>

        <nav className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'live' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <PlayCircle className="w-3 h-3" /> REAL-TIME FEED
          </button>
          <button
            onClick={() => setActiveTab('twin')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'twin' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Boxes className="w-3 h-3" /> DIGITAL TWIN
          </button>
          <button
            onClick={() => setActiveTab('spatial')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'spatial' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ScanText className="w-3 h-3" /> AI ANALYTICS
          </button>
        </nav>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Content Column */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {activeTab === 'live' && (
            <section className="bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative">
              {/* Container matches EXACT video aspect ratio — zero letterboxing */}
              <div style={{aspectRatio: '3452/2064', position: 'relative'}} className="bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  src={currentVideo}
                  controls
                  muted
                  autoPlay
                  crossOrigin="anonymous"
                  style={{width:'100%', height:'100%', objectFit:'fill', display:'block'}}
                />

                {/* SVG overlay — viewBox matches video resolution exactly. No calc(), no % mismatches. */}
                <svg
                  viewBox="0 0 3452 2064"
                  preserveAspectRatio="none"
                  style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none'}}
                >
                  {activeDetections.map((obj, oIdx) => {
                    const x = obj.bbox[0] * 3452;
                    const y = obj.bbox[1] * 2064;
                    const w = obj.bbox[2] * 3452;
                    const h = obj.bbox[3] * 2064;
                    const color = getLabelColor(obj.label);
                    return (
                      <g key={oIdx}>
                        {/* Bounding box rect */}
                        <rect x={x} y={y} width={w} height={h}
                          fill="none" stroke={color} strokeWidth="14" opacity="0.92" />
                        {/* Label background */}
                        <rect x={x} y={Math.max(0, y - 62)} width={220} height={58}
                          fill={color} opacity="0.85" rx="8" />
                        {/* Label text */}
                        <text x={x + 10} y={Math.max(44, y - 14)}
                          fill="white" fontSize="46" fontFamily="monospace" fontWeight="bold">
                          #{obj.id} {obj.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {activeIncident && (
                  <div style={{position:'absolute', top:16, right:16, zIndex:20}}
                    className="bg-orange-600/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase animate-pulse flex items-center gap-2 shadow-2xl border border-orange-400/30">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                    {activeIncident.event_type}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'twin' && (
            <section className="bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative">
              <div className="aspect-video bg-black rounded-xl overflow-hidden relative group">
                <video
                  ref={videoRef}
                  src={currentVideo}
                  controls
                  className="w-full h-full object-contain opacity-40 grayscale-[0.5]"
                />
                
                {/* Simulation Overlays */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur p-4 rounded-xl border border-emerald-500/30 text-[9px] font-mono z-10 shadow-2xl">
                   <div className="text-emerald-400 font-black uppercase mb-2 border-b border-emerald-500/20 pb-1">Simulation Telemetry</div>
                   <div className="text-slate-400 uppercase flex justify-between gap-6"><span>FOV_RES</span> <span>1920x1080</span></div>
                   <div className="text-slate-400 uppercase flex justify-between gap-6"><span>CAM_TILT</span> <span>45 DEG</span></div>
                   <div className="text-slate-400 uppercase flex justify-between gap-6"><span>SYNC_STATE</span> <span className="text-emerald-500">OPTIMAL</span></div>
                </div>

                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur p-3 rounded-lg border border-white/10 text-[10px] font-black uppercase flex items-center gap-3">
                   <Boxes className="text-emerald-500 w-4 h-4" /> 
                   Digital Twin Environment: Wadi Saqra OSM
                </div>
              </div>
            </section>
          )}
          {activeTab === 'spatial' && (
            <section className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex justify-between items-center bg-indigo-900/10 p-3 rounded-xl border border-indigo-500/20">
                <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Vision Processing Board
                </h2>
                <div className="flex gap-4">
                  <span className="text-[10px] text-slate-400 font-mono">MODEL: YOLOv8n</span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">ROI: Road_Mask_V1</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {spatialAnns.map((ann, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-800 bg-black">
                    <img
                      src={`http://localhost:8000/frames/${ann.frame}`}
                      className="w-full h-auto opacity-70"
                    />
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      {ann.objects.map((obj, oIdx) => (
                        <g key={oIdx}>
                          <rect
                            x={`${obj.bbox[0] * 100}%`}
                            y={`${obj.bbox[1] * 100}%`}
                            width={`${obj.bbox[2] * 100}%`}
                            height={`${obj.bbox[3] * 100}%`}
                            fill="none"
                            stroke={getLabelColor(obj.label)}
                            strokeWidth="1.5"
                            className="drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]"
                          />
                          <rect
                            x={`${obj.bbox[0] * 100}%`}
                            y={`${obj.bbox[1] * 100 - 1.5}%`}
                            width="24"
                            height="8"
                            fill={getLabelColor(obj.label)}
                            className="opacity-90"
                          />
                          <text
                            x={`${obj.bbox[0] * 100 + 0.5}%`}
                            y={`${obj.bbox[1] * 100 - 0.2}%`}
                            fill="white"
                            fontSize="6"
                            className="font-black uppercase font-mono"
                          >
                            #{obj.id} {Math.round(obj.confidence * 100)}%
                          </text>
                        </g>
                      ))}
                    </svg>
                    <div className="absolute top-4 right-4 bg-slate-950/80 backdrop-blur px-3 py-1 rounded text-[10px] font-mono border border-slate-700 flex flex-col items-end">
                      <div className="text-slate-400">TIMESTAMP: {ann.frame}</div>
                      <div className="text-emerald-400 font-bold">DETECTED: {ann.objects.length} OBJECTS</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-12 gap-6">
            <section className="col-span-12 md:col-span-7 bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-green-400 mb-6 uppercase tracking-widest">
                <Activity className="w-4 h-4" /> Traffic Flow Volume
              </h2>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val, i) => i % 8 === 0 ? val : ''} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                    <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {activeTab === 'twin' && (
              <section className="col-span-12 md:col-span-5 bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col">
                <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-400 mb-6 uppercase tracking-widest">
                  <Signal className="w-4 h-4" /> Signal HUD
                </h2>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  {[1, 2, 3, 4].map(p => (
                    <div key={p} className="bg-black/40 rounded-xl border border-slate-800 p-4 flex flex-col items-center justify-between">
                       <div className="text-[10px] font-bold text-slate-500 uppercase">Phase {p}</div>
                       <div className={`w-10 h-10 rounded-full shadow-lg ${currentSignals[String(p)] === 'GREEN' ? 'bg-emerald-500 shadow-emerald-500/20' : currentSignals[String(p)] === 'YELLOW' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'live' && (
              <section className="col-span-12 md:col-span-5 bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center opacity-50 italic">
                 <Monitor className="w-12 h-12 text-slate-800 mb-4" />
                 <div className="text-xs text-slate-500">Technical telemetry available in Digital Twin view</div>
              </section>
            )}
          </div>
        </div>

        {/* Right Column - Status & Intelligence */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          
          {/* Site Telemetry Panel */}
          <section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
             <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-400" />
                <h2 className="text-xs font-black text-white uppercase tracking-widest">Site Telemetry</h2>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                   <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Active Flow</div>
                   <div className="text-2xl font-black text-white leading-none">{activeDetections.length}</div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shadow-inner">
                   <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Session Total</div>
                   <div className="text-2xl font-black text-white leading-none">{cumulativeCount}</div>
                </div>
             </div>
          </section>

          {/* Incident Feed Panel */}
          <section className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex-1 flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between mb-5">
               <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  <h2 className="text-xs font-black text-white uppercase tracking-widest">Incident Feed</h2>
               </div>
               <div className="bg-orange-950/40 px-2 py-0.5 rounded text-[9px] text-orange-400 font-bold uppercase border border-orange-900/50">Live</div>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {incidents.map((incident, i) => (
                <button
                  key={i}
                  onClick={() => handleIncidentClick(incident)}
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${activeIncident?.event_id === incident.event_id
                      ? 'bg-orange-600/10 border-orange-500/50 ring-1 ring-orange-500/20'
                      : 'bg-slate-950/40 border-slate-800/50 hover:border-slate-600'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] font-bold uppercase ${activeIncident?.event_id === incident.event_id ? 'text-orange-400' : 'text-slate-400'}`}>{incident.event_type}</span>
                    <span className="text-[9px] font-mono text-slate-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {incident.start_time}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed italic">{incident.notes}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Node Diagnostics (formerly Parameters) */}
          <section className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
             <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-slate-500" />
                <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Edge Diagnostics</h2>
             </div>
             <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                   <span className="text-[9px] text-slate-500 uppercase">Compute Mode</span>
                   <span className="text-[9px] text-emerald-500 font-bold">ARM64_INFERENCE</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                   <span className="text-[9px] text-slate-500 uppercase">Detection Engine</span>
                   <span className="text-[9px] text-blue-400 font-bold">YOLOv8m_GROUNDED</span>
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[9px] text-slate-500 uppercase">Site Reference</span>
                   <span className="text-[9px] text-slate-300 font-mono">WADI_SAQRA_P1</span>
                </div>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
