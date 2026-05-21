"use client";

import { useAppContext } from "@/lib/HackathonContext";
import { Activity, AlertCircle, CheckCircle2, ChevronRight, Wand2, XCircle, FileSearch, Wrench, ShieldAlert } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { motion, AnimatePresence } from "framer-motion";

export default function OptimizerPanel() {
  const { state, applyAutoFix } = useAppContext();
  const result = state.optimizerResult;

  if (!result) return null;

  const getScoreColor = (sc: number) => {
    if (sc >= 90) return "text-emerald-500";
    if (sc >= 75) return "text-amber-500";
    return "text-red-500";
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "Strong": return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      case "Acceptable": return <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />;
      case "Needs Improvement": return <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      default: return <Activity className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />;
    }
  };

  return (
    <motion.div 
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      className="md:w-[460px] h-full border-l border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] custom-scrollbar overflow-y-auto print:hidden"
    >
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 p-6 z-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="flex items-center font-black text-xl text-slate-800 tracking-tight">
            <Activity className="w-5 h-5 mr-3 text-indigo-600" /> Expert Review Engine
          </h2>
          {!!state.fixDiff && <Badge variant="success">Synchronized</Badge>}
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* A. OVERALL SCORE & SUMMARY */}
        <section>
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-5 rounded-2xl mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Architecture Health</p>
              <p className="text-sm font-medium text-slate-600">Based on multi-heuristic deep scan.</p>
            </div>
            <div className={`text-4xl font-black tracking-tighter ${getScoreColor(result.overallScore)}`}>
              {result.overallScore}<span className="text-xl text-slate-300">/100</span>
            </div>
          </div>
          <div className="text-sm leading-relaxed text-slate-600 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
            <strong className="text-indigo-900 block mb-1">Analyst Summary:</strong>
            {result.analystSummary}
          </div>
        </section>

        {/* POST-FIX LOG */}
        <AnimatePresence>
          {!!state.fixDiff && result.fixSummary && result.fixSummary.length > 0 && (
            <motion.section 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 overflow-hidden shadow-sm"
            >
              <h3 className="text-sm font-bold text-emerald-900 flex items-center mb-4 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-600" /> What Changed
              </h3>
              <div className="space-y-4">
                {result.fixSummary.map((fix, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-emerald-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50">{fix.category}</Badge>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-1 leading-snug">{fix.description}</p>
                    <p className="text-xs text-emerald-600 flex items-start mt-2 bg-emerald-50/50 p-2 rounded-md">
                      <ChevronRight className="w-3 h-3 mr-1 shrink-0 mt-0.5" />
                      {fix.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ONLY SHOW ISSUES IF NOT FIXED YET */}
        {!state.fixDiff && (
          <>
            {/* B. SECTION-BY-SECTION REVIEW */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                <FileSearch className="w-4 h-4 mr-2" /> Section-by-Section Assessment
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {result.sectionReviews.map((rev, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                    <span className="text-sm font-semibold text-slate-700">{rev.sectionName}</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                      {getStatusIcon(rev.status)} 
                      <span className={`text-xs font-medium ${rev.status === 'Needs Improvement' ? 'text-rose-600' : 'text-slate-600'}`}>
                        {rev.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* C, D & F. DETECTED ISSUES & RECOMMENDATIONS */}
            <section>
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center">
                  <ShieldAlert className="w-4 h-4 mr-2 text-rose-400" /> Detected Architecture Flaws ({result.issues.length})
                </h3>
              </div>
              
              {result.issues.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 p-6 flex flex-col items-center justify-center rounded-2xl text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">No critical weaknesses detected in the current architecture flow.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {result.issues.map((issue, idx) => (
                    <div key={idx} className="rounded-2xl border border-rose-100 bg-white overflow-hidden shadow-sm">
                      {/* ISSUE DIAGNOSIS */}
                      <div className="bg-rose-50/50 p-4 border-b border-rose-100">
                        <div className="flex gap-2 items-center mb-2">
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                          <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Flaw Detected</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug mb-2 flex items-start">
                          <span className="text-rose-500 mr-2 mt-0.5">•</span> {issue.whatIsWrong}
                        </p>
                        <p className="text-xs text-rose-600 font-medium leading-relaxed pl-3 border-l-2 border-rose-200 ml-1">
                          <strong>Why it matters:</strong> {issue.whyItMatters}
                        </p>
                      </div>
                      
                      {/* RECOMMENDATION */}
                      <div className="bg-indigo-50/30 p-4 relative">
                        <div className="absolute top-0 right-4 -mt-3 bg-indigo-100 border border-indigo-200 text-indigo-800 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center">
                          <Wrench className="w-3 h-3 mr-1" /> Recommendation
                        </div>
                        <p className="text-sm text-indigo-900 font-medium leading-relaxed mb-3 mt-1">
                          {issue.whatShouldChange}
                        </p>
                        <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-1">Proposed Better Version</p>
                          <p className="text-sm text-slate-700 leading-snug italic">&quot;{issue.betterVersion}&quot;</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* E. AUTO FIX SUBMISSION */}
                  <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20" />
                    <div className="relative z-10">
                      <h4 className="text-sm font-bold flex items-center mb-2 uppercase tracking-wide">
                        <Wand2 className="w-4 h-4 mr-2 text-indigo-400" /> Auto-Fix Actions Ready
                      </h4>
                      <p className="text-sm text-slate-300 font-light leading-relaxed mb-6">
                        Click below to allow the Intelligence Engine to automatically rewrite your architecture logic to match the recommended parameters.
                      </p>
                      <Button onClick={applyAutoFix} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white border-none shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all">
                        <Wand2 className="w-4 h-4 mr-2" /> Apply Expert Fixes
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </motion.div>
  );
}
