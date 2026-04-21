import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Activity, AlertTriangle, Info, MapPin, Navigation, Signal, ShieldCheck, PlayCircle, Clock, Maximize2, Layers, Cpu, ScanText, Monitor, Boxes
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
          setCurrentVideo(`http://localhost:8000/video/${clipList.clips[0].source_file}`);
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
        const frameId = Math.floor(currentTime_sec * fps);
        const detections = streamIntel.frames[frameId] || [];
        setActiveDetections(detections);
      }

      // 2. Simulation Sync (HH:MM:SS)
      const h = Math.floor(currentTime_sec / 3600);
      const m = Math.floor((currentTime_sec % 3600) / 60);
      const s = Math.floor(currentTime_sec % 60);
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

      // Signals
      const relevantLogs = signalLogs.filter(log => log.time <= timeStr);
      if (relevantLogs.length > 0) {
        const latestState = {};
        relevantLogs.forEach(log => {
          latestState[String(log.phase)] = log.state.split(' ')[0];
        });
        setCurrentSignals(prev => ({...prev, ...latestState}));
      }

      // Lane Grid
      const trafficEntry = trafficData.find(d => d.time.startsWith(timeStr.substring(0, 5)));
      if (trafficEntry?.lanes) {
        setCurrentLanes(trafficEntry.lanes);
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
    const videoUrl = `http://localhost:8000/video/${incident.video_file}`;

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
              <div className="aspect-video bg-black rounded-xl overflow-hidden relative group">
                <video
                  ref={videoRef}
                  src={currentVideo}
                  controls
                  className="w-full h-full object-contain"
                />

                {/* Real-time synchronized overlay */}
                <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                  {activeDetections.map((obj, oIdx) => (
                    <g key={oIdx}>
                      <rect
                        x={`${obj.bbox[0] * 100}%`}
                        y={`${obj.bbox[1] * 100}%`}
                        width={`${obj.bbox[2] * 100}%`}
                        height={`${obj.bbox[3] * 100}%`}
                        fill="none"
                        stroke={getLabelColor(obj.label)}
                        strokeWidth="2"
                        className="opacity-90"
                      />
                      <rect
                        x={`${obj.bbox[0] * 100}%`}
                        y={`${obj.bbox[1] * 100 - 2}%`}
                        width="30"
                        height="8"
                        fill={getLabelColor(obj.label)}
                        className="opacity-100"
                      />
                      <text
                        x={`${obj.bbox[0] * 100 + 0.5}%`}
                        y={`${obj.bbox[1] * 100 - 0.4}%`}
                        fill="white"
                        fontSize="6"
                        className="font-black uppercase font-mono"
                      >
                        #{obj.id} {obj.label} {obj.speed > 0 ? `| ${obj.speed} KM/H` : ''}
                      </text>
                    </g>
                  ))}
                </svg>

                {activeIncident && (
                  <div className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase animate-bounce flex items-center gap-2 shadow-lg z-10">
                    <AlertTriangle className="w-3 h-3" /> {activeIncident.event_type}: DETECTED
                  </div>
                )}

                {/* AI Status Badge */}
                <div className="absolute bottom-12 right-4 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] font-mono z-10 shadow-xl">
                  <div className="text-blue-400">SYNC_FPS: {streamIntel?.metadata?.fps || 30}</div>
                  <div className="text-emerald-400 font-bold uppercase">Active Nodes: {activeDetections.length}</div>
                </div>
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

        {/* Right Column */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 h-[500px] flex flex-col">
            <h2 className="flex items-center gap-2 text-sm font-bold text-orange-400 mb-4 uppercase tracking-widest">
              <AlertTriangle className="w-4 h-4" /> Incident Feed
            </h2>
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {incidents.map((incident, i) => (
                <button
                  key={i}
                  onClick={() => handleIncidentClick(incident)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${activeIncident?.event_id === incident.event_id
                      ? 'bg-orange-600/20 border-orange-500/50'
                      : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-500'
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase text-orange-400">{incident.event_type}</span>
                    <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1"><Clock className="w-2 h-2" /> {incident.start_time}</span>
                  </div>
                  <p className="text-xs text-slate-300 mb-1 line-clamp-2">{incident.notes}</p>
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'twin' && (
            <section className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-6 uppercase tracking-widest">
                <Layers className="w-4 h-4" /> Edge Dynamics
              </h2>
              <div className="grid grid-cols-5 gap-1 mb-6">
                {Object.entries(currentLanes).slice(0, 20).map(([id, count]) => (
                  <div key={id} style={{ opacity: Math.max(0.1, count / 15) }} className="bg-blue-500 aspect-square rounded-sm border border-black flex items-center justify-center text-[7px] text-black font-black">
                     {count > 0 ? count : ''}
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex justify-between items-center">
                 <div className="text-[10px] font-mono text-slate-500 uppercase">OSM_LANE_MAP: SYNCED</div>
                 <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Wadi Saqra</div>
              </div>
            </section>
          )}

          {activeTab === 'live' && (
            <section className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-4 uppercase tracking-widest">
                Node Parameters
              </h2>
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">GPS Coordinates</div>
                  <div className="text-xs font-mono text-blue-400">{siteInfo?.metadata?.gps_coordinates?.latitude}, {siteInfo?.metadata?.gps_coordinates?.longitude}</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Compute Environment</div>
                  <div className="text-xs font-bold text-emerald-500">EDGE_NODE (ARM64)</div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Active Object Classes</div>
                  <div className="flex gap-2 mt-1">
                    {['Car', 'Bus', 'Truck'].map(c => <span key={c} className="text-[8px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{c}</span>)}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
