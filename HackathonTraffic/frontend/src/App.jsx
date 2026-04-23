import React, { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell
} from 'recharts';
import {
  Activity, AlertCircle, Info, Map, Video, ShieldCheck, Clock, Cpu, Zap, Database, TrendingUp, Settings
} from 'lucide-react';

import Phase2Dashboard from './pages/Phase2Dashboard';

const App = () => {
  const [currentView, setCurrentView] = useState('sandbox'); // 'sandbox' or 'phase2'
  const [siteInfo, setSiteInfo] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [phase2Incidents, setPhase2Incidents] = useState([]);
  const [trafficProfile, setTrafficProfile] = useState([]);
  const [forecasts, setForecasts] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  
  const [cumulativeCount, setCumulativeCount] = useState(0);
  const [visibleVehicles, setVisibleVehicles] = useState(0);
  const [visibleCars, setVisibleCars] = useState(0);
  
  const streamIntelRef = useRef(null);
  const cumulativeIdsRef = useRef(new Set());
  const trackHistoryRef = useRef({});
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const lastDrawTimeRef = useRef(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, incidentRes, clipsRes, streamRes, profileRes, p2dRes, hRes, p2iRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/site-info').catch(() => null),
          fetch('http://localhost:8000/api/v1/incidents').catch(() => null),
          fetch('http://localhost:8000/api/v1/clips').catch(() => null),
          fetch('http://localhost:8000/api/v1/stream-detections').catch(() => null),
          fetch('http://localhost:8000/api/v1/traffic-profile').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/decision-support').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/system-health').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/incidents').catch(() => null)
        ]);

        const info = infoRes ? await infoRes.json() : null;
        const incidentList = incidentRes ? await incidentRes.json() : [];
        const clipList = clipsRes ? await clipsRes.json() : { clips: [] };
        const streamData = streamRes ? await streamRes.json() : { frames: {} };
        const profileData = profileRes ? await profileRes.json() : [];
        const p2Decision = p2dRes ? await p2dRes.json() : {};
        const healthData = hRes ? await hRes.json() : null;
        const p2IncidentList = p2iRes ? await p2iRes.json() : [];

        setSiteInfo(info);
        setIncidents(Array.isArray(incidentList) ? incidentList : []);
        setPhase2Incidents(Array.isArray(p2IncidentList) ? p2IncidentList : []);
        setTrafficProfile(Array.isArray(profileData) ? profileData : []);
        
        // Map decision support to existing sandbox state
        setForecasts(p2Decision.forecast ? { forecasts: p2Decision.forecast, benchmarks: { model_comparisons: p2Decision.benchmarks || [] } } : null);
        setRecommendations(p2Decision.recommendation ? [p2Decision.recommendation] : []);
        setSystemHealth(healthData);
        
        streamIntelRef.current = streamData;
        
        if (clipList.clips && clipList.clips.length > 0) {
          setCurrentVideo(`http://localhost:8000/video/${clipList.clips[0].source_video}`);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getLabelColorRGB = (label) => {
    switch (label?.toLowerCase()) {
      case 'car': return '59, 130, 246'; // blue-500
      case 'bus': return '16, 185, 129'; // emerald-500
      case 'truck': return '245, 158, 11'; // amber-500
      default: return '100, 116, 139';
    }
  };

  const [liveTrafficState, setLiveTrafficState] = useState({
    counts: { North: 0, South: 0, East: 0, West: 0 },
    pressure: { North: 0, South: 0, East: 0, West: 0 }
  });

  const syncDetections = (timestamp) => {
    if (!videoRef.current || !canvasRef.current || !streamIntelRef.current?.frames) {
      requestRef.current = requestAnimationFrame(syncDetections);
      return;
    }

    if (timestamp - lastDrawTimeRef.current < 33) {
      requestRef.current = requestAnimationFrame(syncDetections);
      return;
    }
    lastDrawTimeRef.current = timestamp;

    const currentTime_sec = videoRef.current.currentTime;
    const fps = streamIntelRef.current.metadata?.fps || 30;
    const totalFrames = streamIntelRef.current.metadata?.total_frames || 0;
    const frameId = Math.floor(currentTime_sec * fps);
    
    if (totalFrames > 0 && frameId >= totalFrames - 1) {
      videoRef.current.currentTime = 0;
      cumulativeIdsRef.current.clear();
      trackHistoryRef.current = {};
      setCumulativeCount(0);
      requestRef.current = requestAnimationFrame(syncDetections);
      return;
    }

    const detections = streamIntelRef.current.frames[frameId] || [];
    const N_LINE = 0.35; const S_LINE = 0.65; const E_LINE = 0.65; const W_LINE = 0.35;
    
    let newlyCounted = 0;
    let currentCars = 0;
    
    // Directional Classification Logic
    const currentDirectionalCounts = { North: 0, South: 0, East: 0, West: 0 };
    const currentDirectionalPressure = { North: 0, South: 0, East: 0, West: 0 };
    
    const currentIds = new Set(detections.map(d => d.id));
    
    Object.keys(trackHistoryRef.current).forEach(id => {
       if (!currentIds.has(Number(id))) delete trackHistoryRef.current[id];
    });

    detections.forEach(d => {
      const cx = d.bbox[0] + d.bbox[2]/2;
      const cy = d.bbox[1] + d.bbox[3]/2;
      
      // Classify Approach based on Wadi Saqra geometry
      if (cy < 0.4) currentDirectionalCounts.North++;
      else if (cy > 0.6) currentDirectionalCounts.South++;
      else if (cx > 0.6) currentDirectionalCounts.East++;
      else if (cx < 0.4) currentDirectionalCounts.West++;

      if (d.label.toLowerCase() === 'car') currentCars++;
      if (!cumulativeIdsRef.current.has(d.id)) {
        const prev = trackHistoryRef.current[d.id];
        if (prev) {
          if ((prev.cy < N_LINE && cy >= N_LINE) || (prev.cy > S_LINE && cy <= S_LINE) || 
              (prev.cx < W_LINE && cx >= W_LINE) || (prev.cx > E_LINE && cx <= E_LINE)) {
            cumulativeIdsRef.current.add(d.id);
            newlyCounted++;
          }
        }
      }
      trackHistoryRef.current[d.id] = { cx, cy };
    });

    // Calculate Queue Pressure (Heuristic: Count / Lane Capacity)
    Object.keys(currentDirectionalCounts).forEach(dir => {
       const count = currentDirectionalCounts[dir];
       currentDirectionalPressure[dir] = Math.min(100, Math.round((count / 15) * 100)); 
    });
    
    if (newlyCounted > 0) setCumulativeCount(cumulativeIdsRef.current.size);
    if (frameId % 5 === 0) {
       setVisibleVehicles(detections.length);
       setVisibleCars(currentCars);
       setLiveTrafficState({ counts: currentDirectionalCounts, pressure: currentDirectionalPressure });
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([15, 15]);
    ctx.beginPath(); ctx.moveTo(0, height * N_LINE); ctx.lineTo(width, height * N_LINE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, height * S_LINE); ctx.lineTo(width, height * S_LINE); ctx.stroke();
    ctx.setLineDash([]);

    detections.forEach(obj => {
      const x = obj.bbox[0] * width; const y = obj.bbox[1] * height;
      const w = obj.bbox[2] * width; const h = obj.bbox[3] * height;
      const rgb = getLabelColorRGB(obj.label);
      ctx.strokeStyle = `rgba(${rgb}, 0.8)`; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = `rgba(${rgb}, 0.9)`; ctx.fillRect(x, Math.max(0, y - 25), 100, 25);
      ctx.fillStyle = 'white'; ctx.font = 'bold 16px monospace';
      ctx.fillText(`#${obj.id} ${obj.label}`, x + 5, Math.max(18, y - 7));
    });

    requestRef.current = requestAnimationFrame(syncDetections);
  };

  useEffect(() => {
    if (!loading && streamIntelRef.current) {
      requestRef.current = requestAnimationFrame(syncDetections);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [loading]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <Cpu className="w-12 h-12 text-blue-500 animate-spin" />
      <div className="text-blue-400 font-mono text-xl tracking-tighter">
        INITIALIZING SYSTEM HUB...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans selection:bg-blue-500/30">
      
      {/* NAVIGATION TOGGLE */}
      <nav className="flex justify-center mb-8">
        <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex gap-2 backdrop-blur-md">
          <button 
            onClick={() => setCurrentView('sandbox')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === 'sandbox' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Operational Sandbox
          </button>
          <button 
            onClick={() => setCurrentView('phase2')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${currentView === 'phase2' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Phase 2 Results Hub
          </button>
        </div>
      </nav>

      {currentView === 'phase2' ? (
        <Phase2Dashboard liveTrafficState={liveTrafficState} />
      ) : (
        <div className="animate-in fade-in duration-700">
          {/* GLOBAL HEADER & SYSTEM HEALTH */}
          <header className="flex flex-col md:flex-row justify-between gap-6 mb-8 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600/20 p-3 rounded-xl border border-blue-500/30">
                <ShieldCheck className="text-blue-400 w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight uppercase bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Traffic Intelligence HUD</h1>
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-1">
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> PHASE 2 ACTIVE</span>
                  <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                  <span>SITE: {siteInfo?.metadata?.site_name || 'AMM-WS-01'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-2xl">
              {[
                { label: 'Ingestion', value: systemHealth?.ingestion_status || 'OFFLINE', icon: Database, color: 'text-emerald-400' },
                { label: 'Uptime', value: systemHealth?.stream_uptime_min ? `${systemHealth.stream_uptime_min}m` : '--', icon: Activity, color: 'text-blue-400' },
                { label: 'Dropped', value: systemHealth?.dropped_frames || 0, icon: AlertCircle, color: 'text-orange-400' },
                { label: 'Faults', value: systemHealth?.invalid_record_count || 0, icon: ShieldCheck, color: 'text-emerald-400' }
              ].map((item, i) => (
                <div key={i} className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                    <item.icon className="w-3 h-3" /> {item.label}
                  </div>
                  <div className={`text-sm font-black ${item.color}`}>{item.value}</div>
                </div>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 flex flex-col gap-8">
              <section className="bg-slate-900 p-2 rounded-3xl border border-slate-800 shadow-2xl relative group">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-[10px] font-black rounded-full z-10 shadow-lg flex items-center gap-2">
                  <Video className="w-3 h-3" /> LIVE CV GROUND-TRUTH
                </div>
                <div style={{aspectRatio: '3452/2064', position: 'relative'}} className="bg-black rounded-2xl overflow-hidden border border-slate-800/50">
                  {currentVideo && <video ref={videoRef} src={currentVideo} muted autoPlay crossOrigin="anonymous" className="w-full h-full object-fill" />}
                  <canvas ref={canvasRef} width={3452} height={2064} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                  <div className="absolute bottom-6 right-6 flex flex-col gap-2">
                    <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/50 flex items-center gap-4 shadow-2xl">
                      <div className="text-center border-r border-slate-700 pr-4">
                        <div className="text-[9px] text-slate-500 font-bold uppercase">Visible</div>
                        <div className="text-xl font-black text-white">{visibleVehicles}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-emerald-500 font-bold uppercase">Session</div>
                        <div className="text-xl font-black text-emerald-400">{cumulativeCount}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                       <TrendingUp className="w-5 h-5 text-blue-400" />
                       <h2 className="text-xs font-black uppercase tracking-widest">Demand Forecast</h2>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">15m Window</span>
                  </div>
                  <div className="space-y-4">
                    {forecasts?.forecasts?.predictions?.map((pred, i) => (
                      <div key={i} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">Next {pred.horizon_mins || pred.horizon}</div>
                          <div className="text-lg font-black text-white">{pred.predicted_volume} <span className="text-xs text-slate-500 font-normal">veh</span></div>
                        </div>
                        <div className="text-right text-xs font-mono text-blue-400">{(pred.confidence * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">Validation Performance</h2>
                  </div>
                  <div className="h-[120px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={forecasts?.benchmarks?.model_comparisons || []}>
                        <Bar dataKey="MAE" radius={[4, 4, 0, 0]}>
                          {(forecasts?.benchmarks?.model_comparisons || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 2 ? '#3b82f6' : '#1e293b'} />
                          ))}
                        </Bar>
                        <Tooltip contentStyle={{backgroundColor:'#0f172a', border:'1px solid #334155', borderRadius:'12px', fontSize:'10px'}} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-8">
              <section className="bg-slate-900 p-6 rounded-3xl border border-blue-500/20 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-100">Signal Optimization Support</h2>
                  </div>
                </div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-black bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase">Phase {rec.recommended_green_phase}</span>
                        <span className="text-[10px] font-mono text-slate-500">{rec.supporting_video_metrics?.top_approach} Approach</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mb-3">{rec.queue_summary}</p>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl text-[11px] text-emerald-200/70 italic">
                        {rec.expected_effect}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">System Incident Log</h2>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                  {phase2Incidents.map((incident, i) => (
                    <div key={`p2-${i}`} className="bg-orange-500/5 border border-orange-500/20 p-4 rounded-2xl">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-3 h-3 animate-pulse" /> {incident.event_type}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-300 font-medium">{incident.notes}</p>
                    </div>
                  ))}
                  {incidents.map((incident, i) => (
                    <div key={i} className="w-full text-left p-4 rounded-2xl border border-slate-800/50 bg-slate-950/40">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">{incident.event_type}</span>
                        <span className="text-[10px] font-mono text-slate-600">{incident.start_time}</span>
                      </div>
                      <p className="text-[12px] text-slate-400 italic">{incident.notes}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <footer className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-6 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
               <span>Documentation</span>
               <span>Risk Register</span>
               <span>Security Audit</span>
            </div>
            <div className="bg-blue-900/10 border border-blue-500/20 px-6 py-3 rounded-2xl max-w-2xl text-[10px] text-blue-300/60 leading-relaxed text-center italic">
                PHASE 2 FEASIBILITY BUILD: Decision support only. Read-only operations enforced.
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};

export default App;
