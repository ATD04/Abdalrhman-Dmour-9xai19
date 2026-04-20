import React, { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { 
  Activity, AlertTriangle, Info, MapPin, Navigation, Signal, ShieldCheck, PlayCircle, Clock, Maximize2, Layers, Cpu, ScanText
} from 'lucide-react';

const App = () => {
  const [siteInfo, setSiteInfo] = useState(null);
  const [trafficData, setTrafficData] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [spatialAnns, setSpatialAnns] = useState([]);
  const [streamIntel, setStreamIntel] = useState(null);
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
        const [infoRes, trafficRes, incidentRes, clipsRes, spatialRes, streamRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/site-info'),
          fetch('http://localhost:8000/api/v1/traffic-stats'),
          fetch('http://localhost:8000/api/v1/incidents'),
          fetch('http://localhost:8000/api/v1/clips'),
          fetch('http://localhost:8000/api/v1/spatial-annotations'),
          fetch('http://localhost:8000/api/v1/stream-detections')
        ]);

        const info = await infoRes.json();
        const traffic = await trafficRes.json();
        const incidentList = await incidentRes.json();
        const clipList = await clipsRes.json();
        const spatialData = await spatialRes.json();
        const streamData = await streamRes.json();

        setSiteInfo(info);
        setTrafficData(traffic);
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
    if (videoRef.current && streamIntel?.frames) {
      const currentTime = videoRef.current.currentTime;
      const fps = streamIntel.metadata.fps || 30;
      const frameId = Math.floor(currentTime * fps);
      const detections = streamIntel.frames[frameId] || [];
      setActiveDetections(detections);
    }
    requestRef.current = requestAnimationFrame(syncDetections);
  };

  useEffect(() => {
    if (activeTab === 'live' && !loading && streamIntel) {
      requestRef.current = requestAnimationFrame(syncDetections);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [activeTab, loading, streamIntel]);

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
            <h1 className="text-xl font-bold tracking-tight uppercase">Traffic Intelligence Dashboard</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              WADI SAQRA (AMM-WS-01) | LIVE_STREAM: ACTIVE
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
          
          {activeTab === 'live' ? (
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
              <div className="p-3 flex justify-between items-center text-[9px] text-slate-500 font-mono">
                <div className="flex gap-4">
                   <span>STREAM_ID: 52AO3WSINBO</span>
                   <span className="text-indigo-400 italic">ENGINE: VISION_CORE_V1</span>
                </div>
                <div className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700">STATUS: ANALYZING_LIVE</div>
              </div>
            </section>
          ) : (
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

          {/* Traffic Volume Chart */}
          <section className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-bold text-green-400 mb-6 uppercase tracking-widest">
              <Activity className="w-4 h-4" /> Traffic Flow Volume (24H Simulation)
            </h2>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val, i) => i % 8 === 0 ? val : ''} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155' }} />
                  <Area type="monotone" dataKey="volume" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
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
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    activeIncident?.event_id === incident.event_id 
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
        </div>
      </div>
    </div>
  );
};

export default App;
