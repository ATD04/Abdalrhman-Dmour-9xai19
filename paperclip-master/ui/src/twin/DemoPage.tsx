import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { twinApi } from "./api";
import { AGENTS, PROJECTS } from "./config";
import { useLang } from "./LangContext";
import { cn } from "@/lib/utils";
import {
  Play, CheckCircle2, Circle, ChevronRight, Loader2,
  Briefcase, Radar, Zap, MessageSquare, Network, AlertTriangle,
} from "lucide-react";
import { MarkdownBody } from "@/components/MarkdownBody";

interface DemoStep {
  id: string;
  number: number;
  icon: React.ElementType;
  color: string;
  title: string;
  titleAr: string;
  agentId: string;
  projectId: string;
  issueTemplate: {
    title: string;
    titleAr: string;
    description: string;
  };
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: "cos",
    number: 1,
    icon: Briefcase,
    color: "#4f46e5",
    title: "Chief of Staff — Daily Brief",
    titleAr: "رئيس الديوان — الإحاطة اليومية",
    agentId: AGENTS.cos,
    projectId: PROJECTS.cos,
    issueTemplate: {
      title: "Demo: Daily Ministerial Brief — April 13, 2026",
      titleAr: "عرض: الإحاطة الوزارية اليومية — 13 أبريل 2026",
      description: "Compile the daily brief for the Minister for April 13, 2026. Include: top 3 priorities, active agent updates, and any escalation alerts from overnight processing.",
    },
  },
  {
    id: "radar",
    number: 2,
    icon: Radar,
    color: "#0891b2",
    title: "Executive Radar — Morning Alert",
    titleAr: "الرادار التنفيذي — تنبيه صباحي",
    agentId: AGENTS.radarChief,
    projectId: PROJECTS.radar,
    issueTemplate: {
      title: "Demo: Executive Radar Scan — April 13, 2026",
      titleAr: "عرض: مسح الرادار التنفيذي — 13 أبريل 2026",
      description: "Run morning radar scan across all active Jordan Vision 2030 initiatives. Flag any initiative moving from AMBER to RED status. Identify top 3 risks requiring ministerial attention today.",
    },
  },
  {
    id: "friction",
    number: 3,
    icon: Zap,
    color: "#dc2626",
    title: "Service Friction — Critical Services",
    titleAr: "احتكاك الخدمات — خدمات حرجة",
    agentId: AGENTS.frictionChief,
    projectId: PROJECTS.friction,
    issueTemplate: {
      title: "Demo: Service Friction Scan — April 13, 2026",
      titleAr: "عرض: مسح احتكاك الخدمات — 13 أبريل 2026",
      description: "Identify all services with Friction Score > 80 that are still unresolved from previous weeks. Calculate citizen impact and link to any related Radar or Policy signals.",
    },
  },
  {
    id: "voice",
    number: 4,
    icon: MessageSquare,
    color: "#059669",
    title: "Citizen Voice — Sentiment Alert",
    titleAr: "صوت المواطن — تنبيه المشاعر",
    agentId: AGENTS.voiceChief,
    projectId: PROJECTS.voice,
    issueTemplate: {
      title: "Demo: Citizen Voice Pulse — April 13, 2026",
      titleAr: "عرض: نبض صوت المواطن — 13 أبريل 2026",
      description: "Analyze citizen feedback patterns for the past 7 days. Flag any ministry where Sentiment Index dropped more than 20 points. Cross-reference with active Service Friction alerts.",
    },
  },
  {
    id: "coordination",
    number: 5,
    icon: Network,
    color: "#0f766e",
    title: "Coordination — Integration Brief",
    titleAr: "التنسيق — الإحاطة التكاملية",
    agentId: AGENTS.coordWriter,
    projectId: PROJECTS.coordination,
    issueTemplate: {
      title: "Demo: Coordination Intelligence Brief — April 13, 2026",
      titleAr: "عرض: الإحاطة الاستخباراتية للتنسيق — 13 أبريل 2026",
      description: "Synthesize all signals from today's demo chain: Daily Brief status, Radar alerts, Service Friction FS>80, and Citizen Voice drops. Produce an integrated Coordination Intelligence Brief. Calculate the Escalation Score. If ES > 15, flag for Chief of Staff escalation to Cabinet Secretary.",
    },
  },
];

interface StepState {
  status: "idle" | "running" | "done" | "error";
  issueId?: string;
  runId?: string;
  comment?: string;
}

export function DemoPage() {
  const { t, isAr } = useLang();
  const qc = useQueryClient();
  const [steps, setSteps] = useState<Record<string, StepState>>(() =>
    Object.fromEntries(DEMO_STEPS.map((s) => [s.id, { status: "idle" }]))
  );
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  function updateStep(id: string, update: Partial<StepState>) {
    setSteps((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  async function runStep(step: DemoStep) {
    updateStep(step.id, { status: "running" });
    try {
      // Create issue
      const issue = await twinApi.createIssue({
        title: isAr ? step.issueTemplate.titleAr : step.issueTemplate.title,
        description: step.issueTemplate.description,
        priority: "high",
        projectId: step.projectId,
        assigneeAgentId: step.agentId,
      });

      updateStep(step.id, { issueId: issue.id });

      // Wake agent
      const wakeResult = await twinApi.wakeAgent(step.agentId, { issueId: issue.id });
      updateStep(step.id, { runId: wakeResult.runId });

      // Wait for completion (poll up to 3 min)
      let completed = false;
      for (let i = 0; i < 18; i++) {
        await new Promise((res) => setTimeout(res, 10_000));
        const runs = await twinApi.getLiveRuns();
        const run = runs.find((r) => r.id === wakeResult.runId);
        if (!run) {
          completed = true;
          break;
        }
        if (run.status === "completed" || run.status === "done" || run.status === "failed") {
          completed = true;
          break;
        }
      }

      // Fetch comments
      const comments = await twinApi.getIssueComments(issue.id);
      const lastComment = comments[comments.length - 1]?.body ?? "";
      updateStep(step.id, { status: "done", comment: lastComment });
      qc.invalidateQueries({ queryKey: ["twin"] });
    } catch (err) {
      updateStep(step.id, { status: "error" });
    }
  }

  async function runFullDemo() {
    setDemoRunning(true);
    // Reset
    setSteps(Object.fromEntries(DEMO_STEPS.map((s) => [s.id, { status: "idle" }])));
    for (let i = 0; i < DEMO_STEPS.length; i++) {
      setCurrentStep(i);
      await runStep(DEMO_STEPS[i]);
    }
    setCurrentStep(null);
    setDemoRunning(false);
  }

  async function runSingleStep(step: DemoStep) {
    setCurrentStep(DEMO_STEPS.findIndex((s) => s.id === step.id));
    await runStep(step);
    setCurrentStep(null);
  }

  const allDone = DEMO_STEPS.every((s) => steps[s.id]?.status === "done");

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("Live Demo Flow", "تدفق العرض الحي")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "End-to-end ministerial intelligence chain — Daily Brief → Radar → Friction → Voice → Coordination Brief",
              "سلسلة الاستخبارات الوزارية الكاملة — إحاطة يومية ← رادار ← احتكاك ← صوت ← إحاطة التنسيق",
            )}
          </p>
        </div>
        <button
          onClick={runFullDemo}
          disabled={demoRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {demoRunning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {t("Running…", "جاري التنفيذ…")}</>
          ) : (
            <><Play className="w-4 h-4" /> {t("Run Full Demo", "تشغيل العرض الكامل")}</>
          )}
        </button>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 mb-6 text-xs">
        <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 shrink-0" />
        <p className="text-yellow-700 dark:text-yellow-300">
          {t(
            "Full demo creates real issues and wakes agents. Each step takes 1–3 minutes. You can also run steps individually.",
            "العرض الكامل يُنشئ مهام حقيقية ويوقظ العملاء. كل خطوة تستغرق 1–3 دقائق. يمكنك أيضاً تشغيل الخطوات بشكل فردي.",
          )}
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {DEMO_STEPS.map((step, idx) => {
          const state = steps[step.id];
          const Icon = step.icon;
          const isActive = currentStep === idx;

          return (
            <div
              key={step.id}
              className={cn(
                "border rounded-lg bg-card overflow-hidden transition-all",
                isActive ? "border-primary shadow-sm" : "border-border",
              )}
            >
              {/* Step header */}
              <div className="flex items-center gap-3 p-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: step.color }}>
                  {state.status === "done" ? <CheckCircle2 className="w-4 h-4" /> :
                    state.status === "running" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                    state.status === "error" ? "!" : step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {isAr ? step.titleAr : step.title}
                  </p>
                  {state.status === "running" && (
                    <p className="text-xs text-blue-600 animate-pulse mt-0.5">
                      {t("Agent working…", "العميل يعمل…")}
                    </p>
                  )}
                  {state.status === "done" && (
                    <p className="text-xs text-green-600 mt-0.5">{t("Complete", "مكتمل")}</p>
                  )}
                </div>
                {!demoRunning && state.status === "idle" && (
                  <button
                    onClick={() => runSingleStep(step)}
                    className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border px-2 py-1 rounded transition"
                  >
                    <Play className="w-3 h-3" /> {t("Run", "تشغيل")}
                  </button>
                )}
              </div>

              {/* Output */}
              {state.comment && (
                <div className="border-t border-border px-4 py-3 bg-muted/20">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t("Agent Output", "مخرجات العميل")}
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                    <MarkdownBody>{state.comment.slice(0, 800) + (state.comment.length > 800 ? "\n\n…" : "")}</MarkdownBody>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Success banner */}
      {allDone && (
        <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
              {t("Demo complete", "اكتمل العرض")}
            </p>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400">
            {t(
              "All 5 steps executed. The Coordination Brief has been compiled with signals from all domains.",
              "تم تنفيذ جميع الخطوات الخمس. تم تجميع إحاطة التنسيق مع إشارات من جميع المجالات.",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
