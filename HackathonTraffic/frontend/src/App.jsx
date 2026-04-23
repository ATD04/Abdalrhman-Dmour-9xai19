import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line
} from 'recharts';
import {
  Activity, AlertCircle, Info, Map as MapIcon, Video, ShieldCheck, Clock, Cpu, Zap, Database, TrendingUp, Settings, Calendar
} from 'lucide-react';

const App = () => {
  // --- STATE ---
  const [siteInfo, setSiteInfo] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [phase2Incidents, setPhase2Incidents] = useState([]);
  const [trafficProfile, setTrafficProfile] = useState([]);
  const [forecasts, setForecasts] = useState(null);
  const [googleData, setGoogleData] = useState(null);
  const [systemHealth, setSystemHealth] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState(null);
  
  const [cumulativeCount, setCumulativeCount] = useState(0);
  const [visibleVehicles, setVisibleVehicles] = useState(0);
  const [liveTrafficState, setLiveTrafficState] = useState({
    counts: { North: 0, South: 0, East: 0, West: 0 },
    pressure: { North: 0, South: 0, East: 0, West: 0 }
  });
  
  // --- REFS ---
  const streamIntelRef = useRef(null);
  const cumulativeIdsRef = useRef(new Set());
  const trackHistoryRef = useRef({});
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const lastDrawTimeRef = useRef(0);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [infoRes, incidentRes, clipsRes, streamRes, p2dRes, hRes, p2iRes, gRes] = await Promise.all([
          fetch('http://localhost:8000/api/v1/site-info').catch(() => null),
          fetch('http://localhost:8000/api/v1/incidents').catch(() => null),
          fetch('http://localhost:8000/api/v1/clips').catch(() => null),
          fetch('http://localhost:8000/api/v1/stream-detections').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/decision-support').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/system-health').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/incidents').catch(() => null),
          fetch('http://localhost:8000/api/v1/phase2/google-context').catch(() => null)
        ]);

        const info = infoRes ? await infoRes.json() : null;
        const incidentList = incidentRes ? await incidentRes.json() : [];
        const clipList = clipsRes ? await clipsRes.json() : { clips: [] };
        const streamData = streamRes ? await streamRes.json() : { frames: {} };
        const p2Decision = p2dRes ? await p2dRes.json() : {};
        const healthData = hRes ? await hRes.json() : null;
        const p2IncidentList = p2iRes ? await p2iRes.json() : [];
        const gData = gRes ? await gRes.json() : null;

        setSiteInfo(info);
        setIncidents(Array.isArray(incidentList) ? incidentList : []);
        setPhase2Incidents(Array.isArray(p2IncidentList) ? p2IncidentList : []);
        setGoogleData(gData);
        setSystemHealth(healthData);
        
        // Map forecasting data
        setForecasts(p2Decision.forecast ? { forecasts: p2Decision.forecast, benchmarks: { model_comparisons: p2Decision.benchmarks || [] } } : null);
        
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

  // --- CV SYNC LOGIC ---
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
    
    const currentDirectionalCounts = { North: 0, South: 0, East: 0, West: 0 };
    const currentDirectionalPressure = { North: 0, South: 0, East: 0, West: 0 };
    let newlyCounted = 0;
    const currentIds = new Set(detections.map(d => d.id));
    
    Object.keys(trackHistoryRef.current).forEach(id => {
       if (!currentIds.has(Number(id))) delete trackHistoryRef.current[id];
    });

    detections.forEach(d => {
      const cx = d.bbox[0] + d.bbox[2]/2;
      const cy = d.bbox[1] + d.bbox[3]/2;
      
      if (cy < 0.4) currentDirectionalCounts.North++;
      else if (cy > 0.6) currentDirectionalCounts.South++;
      else if (cx > 0.6) currentDirectionalCounts.East++;
      else if (cx < 0.4) currentDirectionalCounts.West++;

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

    Object.keys(currentDirectionalCounts).forEach(dir => {
       const count = currentDirectionalCounts[dir];
       currentDirectionalPressure[dir] = Math.min(100, Math.round((count / 15) * 100)); 
    });
    
    if (newlyCounted > 0) setCumulativeCount(cumulativeIdsRef.current.size);
    if (frameId % 5 === 0) {
       setVisibleVehicles(detections.length);
       setLiveTrafficState({ counts: currentDirectionalCounts, pressure: currentDirectionalPressure });
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    
    detections.forEach(obj => {
      const x = obj.bbox[0] * width; const y = obj.bbox[1] * height;
      const w = obj.bbox[2] * width; const h = obj.bbox[3] * height;
      const rgb = obj.label.toLowerCase() === 'car' ? '59, 130, 246' : '16, 185, 129';
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

  // --- FUSED DECISION ENGINE ---
  const recommendation = useMemo(() => {
    const { counts, pressure } = liveTrafficState;
    const googleSummary = googleData?.summary || {};
    const scores = {};
    for (const approach of ["North", "South", "East", "West"]) {
      const cvVal = counts[approach] || 0;
      const gFactor = googleSummary["RT-MAIN"]?.avg_congestion || 1.0;
      const gWeight = (approach === "East" || approach === "West") ? (gFactor - 1.0) * 10 : 0;
      scores[approach] = (cvVal * 1.5) + gWeight;
    }
    const topApproach = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    const phase = (topApproach === "North" || topApproach === "South") ? "1" : "3";
    return {
      recommended_phase: phase,
      priority_approach: topApproach,
      demand_score: scores[topApproach].toFixed(1),
      rationale: `Detected ${counts[topApproach]} vehicles on ${topApproach} approach with ${pressure[topApproach]}% queue pressure.`,
      effect: scores[topApproach] > 15 ? "Requesting Green Extension" : "Maintain Standard Cycle"
    };
  }, [liveTrafficState, googleData]);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
      <Cpu className="w-12 h-12 text-blue-500 animate-spin" />
      <div className="text-blue-400 font-mono text-sm tracking-[0.2em] uppercase">Booting Unified Intelligence Hub...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 p-6 font-sans selection:bg-blue-500/30">
      
      {/* 1. SYSTEM HUD (HEADER) */}
      <header className="flex flex-col md:flex-row justify-between gap-6 mb-8 bg-slate-900/40 p-6 rounded-3xl border border-slate-800 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30 shadow-lg shadow-blue-500/10">
            <ShieldCheck className="text-blue-400 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase italic text-white">Unified Traffic Intelligence</h1>
            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono mt-1">
              <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> SITE: WADI SAQRA</span>
              <span className="w-1 h-1 rounded-full bg-slate-700"></span>
              <span>VERSION: V2.5 // NO MOCK ACTIVE</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-xl">
          {[
            { label: 'Ingestion', value: systemHealth?.ingestion_status || 'ONLINE', icon: Database, color: 'text-emerald-400' },
            { label: 'Uptime', value: systemHealth?.stream_uptime_min ? `${systemHealth.stream_uptime_min}m` : '--', icon: Activity, color: 'text-blue-400' },
            { label: 'Dropped', value: systemHealth?.dropped_frames || 0, icon: AlertCircle, color: 'text-orange-400' },
            { label: 'Decision Engine', value: recommendation ? 'RESOLVING' : 'WAITING', icon: Settings, color: 'text-blue-400' }
          ].map((item, i) => (
            <div key={i} className="bg-slate-950/50 p-3 rounded-2xl border border-slate-800/50 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                <item.icon className="w-3 h-3" /> {item.label}
              </div>
              <div className={`text-[12px] font-black ${item.color}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </header>

      {/* 2. MAIN OPERATIONAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: LIVE VIDEO & MOVEMENTS (8 Units) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          <section className="bg-slate-900 p-2 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-4 left-8 px-4 py-1.5 bg-blue-600 text-[10px] font-black rounded-full z-10 shadow-xl flex items-center gap-2 border border-blue-400/30">
              <Video className="w-3.5 h-3.5" /> LIVE CV GROUND-TRUTH
            </div>
            <div style={{aspectRatio: '3452/2064', position: 'relative'}} className="bg-black rounded-[2rem] overflow-hidden border border-slate-800/50">
              {currentVideo && <video ref={videoRef} src={currentVideo} muted autoPlay crossOrigin="anonymous" className="w-full h-full object-fill" />}
              <canvas ref={canvasRef} width={3452} height={2064} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
              
              <div className="absolute bottom-8 right-8 flex gap-3">
                 <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 rounded-2xl border border-slate-700/50 flex items-center gap-6 shadow-2xl">
                    <div className="text-center border-r border-slate-700 pr-6">
                      <div className="text-[9px] text-slate-500 font-black uppercase">Visible</div>
                      <div className="text-2xl font-black text-white">{visibleVehicles}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] text-emerald-500 font-black uppercase">Session</div>
                      <div className="text-2xl font-black text-emerald-400">{cumulativeCount}</div>
                    </div>
                 </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* REAL DIRECTIONAL DEMAND */}
            <section className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50">
               <div className="flex items-center gap-3 mb-8">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-white">Directional Demand Analysis</h2>
               </div>
               <div className="space-y-5">
                  {Object.entries(liveTrafficState.counts).map(([dir, count]) => (
                     <div key={dir} className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50 group hover:bg-slate-900/50 transition-all">
                        <div className="flex justify-between items-center mb-3 text-[10px]">
                           <span className="font-black text-slate-500 uppercase">{dir} Approach</span>
                           <span className={`font-bold ${liveTrafficState.pressure[dir] > 70 ? 'text-red-400' : 'text-blue-400'}`}>{liveTrafficState.pressure[dir]}% Pressure</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                           <div className="text-2xl font-black text-white">{count}</div>
                           <div className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Vehicles</div>
                        </div>
                        <div className="mt-3 w-full bg-slate-800/50 h-1 rounded-full overflow-hidden">
                           <div className={`h-full transition-all duration-1000 ${liveTrafficState.pressure[dir] > 70 ? 'bg-red-500' : 'bg-blue-500'}`} style={{width: `${liveTrafficState.pressure[dir]}%`}} />
                        </div>
                     </div>
                  ))}
               </div>
            </section>

            {/* INCIDENT FEED */}
            <section className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50 flex flex-col">
               <div className="flex items-center gap-3 mb-8">
                  <AlertCircle className="w-5 h-5 text-orange-400" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-white">System Incident Log</h2>
               </div>
               <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                  {phase2Incidents.map((incident, i) => (
                    <div key={`p2-${i}`} className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-2xl">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-3 h-3 animate-pulse" /> {incident.event_type}
                        </span>
                        <span className="text-[8px] font-mono text-slate-600 uppercase">Live Detection</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{incident.notes}</p>
                    </div>
                  ))}
                  {incidents.map((incident, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-slate-800/50 bg-slate-950/30">
                      <div className="text-[9px] font-bold uppercase text-slate-500 mb-1">{incident.event_type}</div>
                      <p className="text-[11px] text-slate-500 italic">{incident.notes}</p>
                    </div>
                  ))}
               </div>
            </section>
          </div>
        </div>

        {/* RIGHT COLUMN: DECISION & CONTEXT (4 Units) */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          
          {/* FUSED DECISION SUPPORT */}
          <section className="bg-blue-600/10 p-8 rounded-[2.5rem] border border-blue-500/30 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full -mr-24 -mt-24 blur-[80px]"></div>
              <div className="flex items-center justify-between mb-10 relative">
                 <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-blue-400" />
                    <h2 className="text-xs font-black uppercase tracking-widest text-white">Decision Support Support</h2>
                 </div>
                 <div className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-tighter shadow-lg shadow-blue-500/20">FUSED ENGINE</div>
              </div>

              <div className="space-y-10 flex-1 relative">
                 <div>
                    <div className="text-[9px] text-blue-400 font-black uppercase mb-4 flex items-center gap-2 tracking-[0.1em]">
                       <Zap className="w-3.5 h-3.5" /> Recommended Green Phase
                    </div>
                    <div className="text-[7rem] font-black text-white italic tracking-tighter leading-[0.8] mb-4">
                       {recommendation?.recommended_phase || "--"}
                    </div>
                    <div className="flex items-center gap-3">
                       <div className="h-1 w-12 bg-blue-500 rounded-full"></div>
                       <div className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em]">
                          Priority: {recommendation?.priority_approach || "Analyzing"}
                       </div>
                    </div>
                 </div>

                 <div className="bg-slate-950/80 p-6 rounded-[1.5rem] border border-slate-800 shadow-2xl border-t-blue-500/30">
                    <div className="flex justify-between items-center text-[9px] mb-4">
                       <span className="text-slate-500 uppercase font-black">Rational Basis</span>
                       <span className="text-emerald-400 font-black uppercase italic tracking-tighter">{recommendation?.effect}</span>
                    </div>
                    <p className="text-[12px] text-slate-200 leading-relaxed font-medium">
                       "{recommendation?.rationale}"
                    </p>
                 </div>

                 <div className="space-y-4">
                    <div className="text-[9px] text-slate-500 font-black uppercase flex items-center gap-2 tracking-widest">
                       <TrendingUp className="w-3.5 h-3.5" /> Short-Term Outlook
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                       {forecasts?.forecasts?.predictions?.map((pred, i) => (
                          <div key={i} className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50 text-center group hover:border-blue-500/30 transition-all">
                             <div className="text-[8px] text-slate-500 font-black uppercase mb-1">{pred.horizon}</div>
                             <div className="text-xl font-black text-white">{pred.predicted_volume}</div>
                             <div className={`text-[7px] font-mono mt-1 ${pred.trend === 'Increasing' ? 'text-blue-400' : 'text-slate-500'}`}>{pred.trend}</div>
                          </div>
                       ))}
                    </div>
                 </div>
              </div>
          </section>

          {/* GOOGLE TRAFFIC CONTEXT */}
          <section className="bg-slate-900/40 p-8 rounded-[2rem] border border-slate-800/50">
             <div className="flex items-center gap-3 mb-8">
                <MapIcon className="w-5 h-5 text-purple-400" />
                <h2 className="text-xs font-black uppercase tracking-widest text-white">Google Traffic Context</h2>
             </div>
             
             <div className="h-[140px] mb-8">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={googleData?.profile || []}>
                      <defs>
                         <linearGradient id="colorUnified" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="congestion_ratio" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorUnified)" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>

             <div className="space-y-3 mb-6">
                {googleData?.profile?.filter(d => d.timestamp === '08:00' || d.timestamp === '16:00').map((probe, i) => (
                   <div key={i} className="flex items-center justify-between p-3 bg-slate-950/40 rounded-xl border border-slate-800/30">
                      <span className="text-[9px] font-black text-slate-500 uppercase">{probe.timestamp} Load</span>
                      <span className={`text-[10px] font-mono font-black ${probe.congestion_ratio > 1.4 ? 'text-orange-400' : 'text-emerald-400'}`}>
                         {probe.congestion_ratio}x Normal
                      </span>
                   </div>
                ))}
             </div>
             <p className="text-[9px] text-slate-600 text-center italic border-t border-slate-800 pt-4 tracking-tighter">
                Real Google Maps API route-level proxy data. Synced for Wadi Saqra.
             </p>
          </section>

        </div>
      </div>

      {/* 3. FOOTER LOGO & STATUS */}
      <footer className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
         <div className="flex items-center gap-8 text-[9px] font-black text-slate-600 uppercase tracking-widest">
            <span className="flex items-center gap-2 text-blue-500/60"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> CV Source</span>
            <span className="flex items-center gap-2 text-purple-500/60"><div className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Google Context</span>
            <span className="flex items-center gap-2 text-emerald-500/60"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Advisory Status</span>
         </div>
         <div className="bg-slate-900/50 px-6 py-2.5 rounded-full border border-slate-800 text-[9px] font-mono text-slate-500 tracking-tighter">
            CRACK-THE-CODE // AMM-WS-01 // NO-MOCK-POLICY: ENABLED
         </div>
      </footer>
    </div>
  );
};

export default App;
