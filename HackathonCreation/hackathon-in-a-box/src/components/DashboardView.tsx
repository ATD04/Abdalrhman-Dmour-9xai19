"use client";

import { useAppContext } from "@/lib/HackathonContext";
import { Copy, Activity, FileText, ArrowRight, CheckCircle2, Shield, Rocket, Target, Users, LayoutDashboard, Compass, Cpu, Clock, CalendarSync, Sparkles, Map, Lightbulb, ListChecks } from "lucide-react";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import OptimizerPanel from "./OptimizerPanel";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardView() {
  const { state, reset, analyzeCurrentPlan } = useAppContext();
  const { plan } = state;

  if (!plan) return null;

  return (
    <div id="dashboard-layout" className="flex flex-col md:flex-row h-screen bg-slate-50 overflow-hidden">

      {/* Left content: The Brief */}
      <div id="brief-content" className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar relative">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 shadow-premium rounded-2xl print:shadow-none print:border-none print:bg-transparent overflow-hidden">

          {/* Header */}
          <div className="p-10 border-b border-slate-100 bg-slate-50/50 print:p-0 print:border-0 print:mb-8 flex flex-col justify-between">
            <div className="flex justify-between items-start no-print mb-6">
              <Badge variant="premium">Architecture Brief</Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>Discard & Restart</Button>
                <Button variant="default" size="sm" onClick={() => window.print()}>
                  <FileText className="w-4 h-4 mr-2" /> Download Architecture PDF
                </Button>
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-black text-slate-900 tracking-tight leading-tight mb-2">{plan.name}</h1>
              <p className="text-xl text-indigo-600 font-medium">{plan.theme}</p>
            </div>
          </div>

          <div className="p-10 print:p-0 space-y-12">

            {/* 1. Purpose */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <Target className="w-5 h-5 mr-3 text-indigo-500" /> 1. Purpose of This Hackathon
              </h2>
              <div className="pl-8 text-slate-600 leading-relaxed">
                {plan.purpose}
              </div>
            </section>

            {/* 2. Name Meaning */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <Compass className="w-5 h-5 mr-3 text-violet-500" /> 2. What Is The <span className="mx-1">&quot;{plan.name}&quot;</span> In This Challenge?
              </h2>
              <div className="pl-8 text-slate-600 leading-relaxed">
                {plan.nameMeaning}
              </div>
            </section>

            {/* 3. Core Challenge */}
            <section className="print-break-inside-avoid bg-indigo-50 p-6 rounded-xl border border-indigo-100 print:bg-transparent print:border-l-4 print:rounded-none">
              <h2 className="text-lg font-bold text-indigo-900 flex items-center mb-3">
                <Rocket className="w-5 h-5 mr-3 text-indigo-600" /> 3. Core Challenge
              </h2>
              <div className="pl-8 text-indigo-800 leading-relaxed font-medium">
                {plan.coreChallenge}
              </div>
            </section>

            {/* 4. Challenge Tracks */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <Map className="w-5 h-5 mr-3 text-blue-500" /> 4. Challenge Tracks
              </h2>
              <div className="pl-8 grid grid-cols-1 md:grid-cols-3 gap-3">
                {plan.tracks.map((track) => (
                  <div key={track.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl print:border-b print:border-slate-200 print:rounded-none print:p-2 print:bg-transparent">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="font-bold text-slate-800 text-sm">{track.name}</h3>
                      <Badge variant="outline" className="shrink-0">{track.difficulty}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{track.description}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 5. Starter Ideas */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <Lightbulb className="w-5 h-5 mr-3 text-amber-500" /> 5. Starter Idea Prompts
              </h2>
              <div className="pl-8 space-y-3">
                {plan.ideaPrompts.map((idea) => {
                  const track = plan.tracks.find((item) => item.id === idea.trackId);

                  return (
                    <div key={idea.id} className="bg-amber-50/60 border border-amber-100 p-4 rounded-xl print:border-b print:bg-transparent print:rounded-none">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-800">{idea.title}</h3>
                        {track && <Badge variant="secondary">{track.name}</Badge>}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">{idea.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 6. Rules */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <ListChecks className="w-5 h-5 mr-3 text-emerald-500" /> 6. Rules & Guidelines
              </h2>
              <div className="pl-8 space-y-2">
                {plan.rulesGuidelines.map((rule, idx) => (
                  <div key={idx} className="flex items-start text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 mt-1 shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Tech Principles */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <Cpu className="w-5 h-5 mr-3 text-emerald-500" /> 7. Technology Principles Suggested
              </h2>
              <div className="pl-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.techPrinciples.map((tp, idx) => (
                  <div key={idx} className="flex flex-col bg-slate-50 border border-slate-100 p-4 rounded-xl print:border-b print:border-slate-200 print:rounded-none print:p-2 print:bg-transparent">
                    <div className="flex items-center mb-1">
                      <Cpu className="w-4 h-4 text-emerald-500 mr-2 shrink-0" />
                      <span className="text-sm font-bold text-slate-800 uppercase tracking-wide">{tp.category}</span>
                    </div>
                    <span className="text-sm text-slate-600 font-medium pl-6">{tp.recommendations}</span>
                  </div>
                ))}
              </div>
            </section>

            <hr className="border-slate-100 print:hidden" />

            {/* 5. Team Format */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <Users className="w-5 h-5 mr-3 text-blue-500" /> 8. Team Format
              </h2>
              <div className="pl-8">
                <div className="flex gap-4 mb-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 print:border-none text-center min-w-[120px]">
                    <div className="text-3xl font-black text-slate-800">{plan.teamFormat.totalTeams}</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Total Teams</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 print:border-none text-center min-w-[120px]">
                    <div className="text-xl font-bold text-slate-800 pt-2">{plan.teamFormat.distribution.split(' ')[0]}</div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Sizing Matrix</div>
                  </div>
                </div>
                <div className="text-slate-600 bg-blue-50/50 p-4 rounded-lg border border-blue-100/50 text-sm leading-relaxed mb-3">
                  <strong className="text-blue-900 block mb-1">Configuration Strategy:</strong>
                  {plan.teamFormat.logic}
                </div>
                <div className="flex gap-2">
                  {plan.teamFormat.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                </div>
              </div>
            </section>

            {/* 6. Leapfrog */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <LayoutDashboard className="w-5 h-5 mr-3 text-amber-500" /> 9. Why This Event Will Leapfrog Skills
              </h2>
              <div className="pl-8 text-slate-600 leading-relaxed border-l-2 border-amber-200 ml-2.5 overflow-visible">
                {plan.skillLeapfrog}
              </div>
            </section>

            <hr className="border-slate-100 print:hidden" />

            {/* 7. Duration */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <Clock className="w-5 h-5 mr-3 text-pink-500" /> 10. Total Duration Logic
              </h2>
              <div className="pl-8 text-slate-600 leading-relaxed font-medium">
                {plan.durationExplanation}
              </div>
            </section>

            {/* 8. Pulse Checks */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <CalendarSync className="w-5 h-5 mr-3 text-cyan-500" /> 11. Pulse Check Timing vs Delivery Schedule
              </h2>
              <div className="pl-8 grid md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Milestone Check-ins</h4>
                  <ul className="space-y-3">
                    {plan.pulseChecks.map((pc, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <span className="font-bold text-cyan-700 min-w-[70px] shrink-0">{pc.time}</span>
                        <span className="text-slate-600">{pc.event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Core Timeline Map</h4>
                  <ul className="space-y-3">
                    {plan.timeline.map((tl, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <span className="font-bold text-slate-800 min-w-[70px] shrink-0">{tl.time}</span>
                        <span className="text-slate-600">{tl.event}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-100 print:page-break" />

            {/* 9. Final Submission */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <FileText className="w-5 h-5 mr-3 text-rose-500" /> 12. Final Submission Deliverables
              </h2>
              <div className="pl-8 space-y-2">
                {plan.finalSubmission.map((fs, idx) => (
                  <div key={idx} className="flex items-start text-slate-600">
                    <ArrowRight className="w-4 h-4 text-rose-400 mr-2 mt-1 shrink-0" />
                    <span>{fs}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 10. Eval Criteria */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-4">
                <Shield className="w-5 h-5 mr-3 text-indigo-500" /> 13. Evaluation Rubric
              </h2>
              <div className="pl-8 space-y-3">
                {plan.judgingCriteria.map((jc, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-lg p-3 border border-slate-100 flex justify-between items-center print:border-b print:bg-transparent print:p-2">
                    <div>
                      <h4 className="font-bold text-slate-800">{jc.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 pr-4">{jc.description}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{jc.weight}%</Badge>
                  </div>
                ))}
              </div>
            </section>

            {/* 11. Awards */}
            <section className="print-break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 flex items-center mb-3">
                <Copy className="w-5 h-5 mr-3 text-amber-500" /> 14. Awards Architecture
              </h2>
              <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plan.awards.map((aw, idx) => (
                  <div key={idx} className="flex items-center bg-amber-50 text-amber-900 border border-amber-100 p-3 rounded-lg print:border-none print:p-1 print:bg-transparent">
                    <Sparkles className="w-4 h-4 text-amber-500 mr-2 shrink-0" />
                    <span className="font-semibold text-sm">{aw}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* 12. Final Standard */}
            <section className="print-break-inside-avoid bg-slate-900 text-white p-8 rounded-2xl print:bg-transparent print:text-black print:border-t-2 print:border-b-2 print:border-black print:rounded-none">
              <h2 className="text-lg font-bold flex items-center mb-3 uppercase tracking-wider">
                <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-400 print:text-black" /> 15. The Final Standard
              </h2>
              <div className="pl-8 text-slate-300 print:text-black leading-relaxed font-light">
                {plan.finalStandard}
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* Right panel: Optimizer (Hidden on print) */}
      <AnimatePresence>
        <motion.div className="no-print h-full shrink-0">
          {!state.showOptimizer ? (
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="md:w-[420px] h-full border-l bg-white flex flex-col items-center justify-center p-8 text-center shrink-0 z-10 shadow-[-8px_0_30px_-15px_rgba(0,0,0,0.1)]"
            >
              <div className="bg-indigo-100 p-5 rounded-full mb-6">
                <Activity className="w-10 h-10 text-indigo-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Intelligence Engine</h3>
              <p className="text-sm text-slate-500 mb-8 max-w-xs leading-relaxed">
                Run an algorithmic check against your brief to detect timeline bottlenecks and participant orphans before generating the final PDF.
              </p>
              <Button variant="premium" size="lg" className="w-full shadow-xl shadow-indigo-500/20" onClick={analyzeCurrentPlan}>
                <Activity className="w-5 h-5 mr-2" /> Validate Architecture
              </Button>
            </motion.div>
          ) : (
            <OptimizerPanel />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
