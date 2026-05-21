"use client";

import { useMemo, useState } from "react";
import { useAppContext } from "@/lib/HackathonContext";
import { SkillLevel } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { ArrowLeft, Loader2, Wand2, Lightbulb, AlertCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DOMAIN_SUGGESTIONS = [
  {
    domain: "HealthTech",
    problems: [
      "Reducing patient no-shows",
      "Improving medication adherence",
      "Simplifying telehealth follow-up",
      "Digital support for chronic disease patients"
    ]
  },
  {
    domain: "ClimateTech",
    problems: [
      "Smart waste sorting",
      "Water usage monitoring",
      "Energy consumption awareness",
      "Sustainable mobility coordination"
    ]
  },
  {
    domain: "EdTech",
    problems: [
      "Lecture summarization",
      "Study planning support",
      "Peer mentoring systems",
      "Academic dropout prevention"
    ]
  },
  {
    domain: "FinTech",
    problems: [
      "Budgeting for students",
      "Fraud awareness tools",
      "Small business cashflow support",
      "Financial literacy gamification"
    ]
  },
  {
    domain: "Smart Cities",
    problems: [
      "Parking optimization",
      "Citizen issue reporting",
      "Smart traffic flow suggestions",
      "Public space accessibility mapping"
    ]
  },
  {
    domain: "Accessibility Tech",
    problems: [
      "Navigation support for visually impaired users",
      "Simplified digital services access",
      "Voice-first interfaces",
      "Inclusive event accessibility planning"
    ]
  },
  {
    domain: "Digital Government",
    problems: [
      "Service request tracking",
      "Citizen appointment management",
      "Form simplification",
      "Public information navigation"
    ]
  },
  {
    domain: "Logistics & Supply Chain",
    problems: [
      "Delivery route optimization",
      "Warehouse visibility",
      "Inventory exception alerts",
      "Small fleet coordination"
    ]
  },
  {
    domain: "Mental Health Support",
    problems: [
      "Early stress check-in tools",
      "Student wellbeing support",
      "Guided self-help journeys",
      "Resource referral matching"
    ]
  }
];

interface FormState {
  domain: string;
  participants: number | "";
  skillLevels: SkillLevel;
  duration: number | "";
  teamSize: number | "";
  learningGoals: string;
}

export default function InputForm({ onBack }: { onBack: () => void }) {
  const { generatePlan, state } = useAppContext();
  
  const [formData, setFormData] = useState<FormState>({
    domain: "",
    participants: "",
    skillLevels: "Mixed",
    duration: "",
    teamSize: "",
    learningGoals: "",
  });

  const [selectedDomainIndex, setSelectedDomainIndex] = useState<number | null>(null);

  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validation = useMemo(() => {
    const newErrors: { [key: string]: string } = {};
    const newWarnings: { [key: string]: string } = {};

    // Domain
    if (!formData.domain.trim()) {
      newErrors.domain = "Please enter a domain or select one of the suggested options.";
    }

    // Participants
    if (formData.participants === "") {
      newErrors.participants = "Please enter the expected number of participants.";
    } else if (formData.participants < 1) {
      newErrors.participants = "Participants must be at least 1.";
    } else if (!Number.isInteger(formData.participants)) {
      newErrors.participants = "Please enter a valid whole number.";
    } else if (formData.participants > 10000) {
      newWarnings.participants = "Large participant counts may strain standard hackathon infrastructure.";
    }

    // Duration
    if (formData.duration === "") {
      newErrors.duration = "Please enter the total duration in hours.";
    } else if (formData.duration < 2) {
      newErrors.duration = "Duration must be at least 2 hours.";
    } else if (formData.duration > 168) {
      newErrors.duration = "Please enter a realistic duration (under 1 week).";
    } else if (formData.duration < 12) {
      newWarnings.duration = "A short duration may limit how much teams can build. Expect MVP prototypes.";
    }

    // Team Size
    if (formData.teamSize === "") {
      newErrors.teamSize = "Please enter a team size.";
    } else if (!Number.isInteger(formData.teamSize)) {
      newErrors.teamSize = "Please enter a valid whole number.";
    } else if (formData.teamSize < 1) {
      newErrors.teamSize = "Team size must be at least 1.";
    } else if (typeof formData.participants === "number" && formData.teamSize > formData.participants) {
      newErrors.teamSize = "Team size cannot be larger than total participants.";
    } else {
      if (formData.teamSize === 1) {
        newWarnings.teamSize = "Solo mode is allowed, but larger teams may improve collaboration and idea diversity.";
      }
      if (typeof formData.participants === "number" && formData.participants > 0 && formData.teamSize > 1) {
        const remainder = formData.participants % formData.teamSize;
        const totalTeams = Math.floor(formData.participants / formData.teamSize);
        if (remainder > 0) {
          newWarnings.teamSizeLogic = `This setup leaves ${remainder} participant(s) unassigned natively. The system can create ${totalTeams} full teams and 1 smaller/flexible team.`;
        } else {
          newWarnings.teamSizeLogic = `Perfect mathematical fit: ${totalTeams} exact teams of ${formData.teamSize} will be created.`;
        }
      }
      if (typeof formData.participants === "number" && formData.teamSize === 1) {
        newWarnings.teamSizeLogic = `Solo mode selected: ${formData.participants} individual projects. This may increase judging complexity.`;
      }
    }

    // Learning Goals
    if (!formData.learningGoals.trim()) {
      newErrors.learningGoals = "Learning goals help the system generate a better hackathon architecture. Please enter at least one.";
    }

    return { errors: newErrors, warnings: newWarnings };
  }, [formData]);

  const { errors, warnings } = validation;

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleDomainSelect = (idx: number) => {
    setSelectedDomainIndex(idx);
    setFormData(prev => ({ ...prev, domain: DOMAIN_SUGGESTIONS[idx].domain }));
    setTouched(prev => ({ ...prev, domain: true }));
  };

  const handleProblemSelect = (problem: string) => {
    const domainText = selectedDomainIndex !== null ? DOMAIN_SUGGESTIONS[selectedDomainIndex].domain : "Innovation";
    setFormData(prev => ({ ...prev, domain: `${domainText}: ${problem}` }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all as touched
    const allTouched: { [key: string]: boolean } = {
      domain: true, participants: true, duration: true, teamSize: true, learningGoals: true
    };
    setTouched(allTouched);

    if (Object.keys(errors).length === 0) {
      // Cast to strict types
      generatePlan({
        domain: formData.domain,
        participants: formData.participants as number,
        skillLevels: formData.skillLevels,
        duration: formData.duration as number,
        teamSize: formData.teamSize as number,
        learningGoals: formData.learningGoals,
      });
    }
  };

  const hasHardErrors = Object.keys(errors).length > 0;

  return (
    <div className="max-w-3xl mx-auto py-12 animate-in slide-in-from-bottom-8 fade-in duration-500">
      <button onClick={onBack} className="flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </button>
      
      <Card className="border-slate-200 shadow-premium overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 pt-8 px-8">
          <CardTitle className="text-3xl font-black text-slate-900 tracking-tight">Hackathon Parameters</CardTitle>
          <p className="text-slate-500 mt-2 font-medium">Define your constraints and problem space. Our engine handles the structural math and architecture.</p>
        </CardHeader>
        
        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="divide-y divide-slate-100">
            
            {/* SUGGESTIONS SECTION */}
            <div className="p-8 bg-indigo-50/30">
              <div className="flex items-center mb-4">
                <Lightbulb className="w-5 h-5 text-amber-500 mr-2" />
                <h3 className="text-sm font-bold text-indigo-900 tracking-wide">Suggested Domains & Problem Ideas</h3>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {DOMAIN_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={item.domain}
                    type="button"
                    onClick={() => handleDomainSelect(idx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${
                      selectedDomainIndex === idx 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    {item.domain}
                  </button>
                ))}
              </div>

              <AnimatePresence>
                {selectedDomainIndex !== null && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select a challenge to apply</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DOMAIN_SUGGESTIONS[selectedDomainIndex].problems.map((problem) => (
                          <button
                            key={problem}
                            type="button"
                            onClick={() => handleProblemSelect(problem)}
                            className="text-left px-3 py-2 rounded-lg text-sm font-medium border border-slate-100 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
                          >
                            {problem}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* FORM FIELDS SECTION */}
            <div className="p-8 space-y-8 bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Domain Input */}
                <div className="space-y-1 col-span-1 md:col-span-2">
                  <Input 
                    label="Primary Domain / Theme" 
                    placeholder="e.g. HealthTech: Reducing patient no-shows" 
                    value={formData.domain}
                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                    onBlur={() => handleBlur("domain")}
                    error={touched.domain ? errors.domain : undefined}
                  />
                </div>

                {/* Participants */}
                <div className="space-y-1">
                  <Input 
                    label="Expected Participants" 
                    type="number" 
                    placeholder="Enter number of participants"
                    value={formData.participants}
                    onChange={e => setFormData({ ...formData, participants: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
                    onBlur={() => handleBlur("participants")}
                    error={touched.participants ? errors.participants : undefined}
                  />
                  {touched.participants && !errors.participants && warnings.participants && (
                    <div className="flex items-start text-xs text-amber-600 font-medium mt-1">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0 mt-0.5" /> {warnings.participants}
                    </div>
                  )}
                </div>
                
                {/* Skill Level */}
                <div className="space-y-1">
                  <label className="text-sm font-semibold tracking-wide text-slate-700 block mb-1">Skill Level Profile</label>
                  <select 
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors hover:border-slate-300"
                    value={formData.skillLevels}
                    onChange={e => setFormData({ ...formData, skillLevels: e.target.value as SkillLevel })}
                  >
                    <option value="Beginner">Beginner (Students/Novices)</option>
                    <option value="Intermediate">Intermediate (Practitioners)</option>
                    <option value="Advanced">Advanced (Professionals)</option>
                    <option value="Mixed">Mixed (All levels)</option>
                  </select>
                </div>

                {/* Duration */}
                <div className="space-y-1">
                  <Input 
                    label="Duration (Hours)" 
                    type="number" 
                    placeholder="Enter total hours"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
                    onBlur={() => handleBlur("duration")}
                    error={touched.duration ? errors.duration : undefined}
                  />
                  {touched.duration && !errors.duration && warnings.duration && (
                    <div className="flex items-start text-xs text-amber-600 font-medium mt-1">
                      <Info className="w-3.5 h-3.5 mr-1 shrink-0 mt-0.5" /> {warnings.duration}
                    </div>
                  )}
                </div>
                
                {/* Team Size */}
                <div className="space-y-1">
                  <Input 
                    label="Default Team Size" 
                    type="number" 
                    placeholder="Enter preferred team size"
                    value={formData.teamSize}
                    onChange={e => setFormData({ ...formData, teamSize: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
                    onBlur={() => handleBlur("teamSize")}
                    error={touched.teamSize ? errors.teamSize : undefined}
                  />
                  {touched.teamSize && !errors.teamSize && warnings.teamSize && (
                    <div className="flex items-start text-xs text-amber-600 font-medium mt-1">
                      <Info className="w-3.5 h-3.5 mr-1 shrink-0 mt-0.5" /> {warnings.teamSize}
                    </div>
                  )}
                </div>
              </div>

              {/* Cross-Field Summary Warning */}
              {warnings.teamSizeLogic && formData.participants !== "" && formData.teamSize !== "" && !errors.participants && !errors.teamSize && (
                <div className={`p-3 rounded-xl border text-sm font-medium flex items-start ${warnings.teamSizeLogic.includes('Perfect') ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>
                  <Info className={`w-4 h-4 mr-2 shrink-0 ${warnings.teamSizeLogic.includes('Perfect') ? 'text-emerald-500' : 'text-blue-500'} mt-0.5`} />
                  <span>{warnings.teamSizeLogic}</span>
                </div>
              )}
              
              {/* Learning Goals */}
              <div className="pt-2">
                <label className="text-sm font-semibold tracking-wide text-slate-700 mb-2 block">Core Learning Goals</label>
                <textarea 
                  className={`flex w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[100px] resize-none transition-colors ${touched.learningGoals && errors.learningGoals ? 'border-red-500 focus-visible:ring-red-500' : 'border-slate-200 hover:border-slate-300'}`}
                  placeholder="e.g. Master React, Build an MVP under pressure, Pitch to Enterprise Investors"
                  value={formData.learningGoals}
                  onChange={e => setFormData({ ...formData, learningGoals: e.target.value })}
                  onBlur={() => handleBlur("learningGoals")}
                />
                {touched.learningGoals && errors.learningGoals && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.learningGoals}</p>
                )}
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="p-8 bg-slate-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">
                {state.generationError ? (
                  <span className="text-red-600">{state.generationError}</span>
                ) : (
                  <span className="text-slate-500">
                    {hasHardErrors ? "Please resolve all errors before generating." : "All parameters stable."}
                  </span>
                )}
              </div>
              <Button type="submit" variant="premium" size="lg" disabled={state.isGenerating || hasHardErrors}>
                {state.isGenerating ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Asking AI to Generate...</>
                ) : (
                  <><Wand2 className="w-5 h-5 mr-2" /> Generate With AI</>
                )}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
