import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { twinApi } from "./api";
import { CAPABILITIES, PROJECTS, type CapabilityKey } from "./config";
import { useLang } from "./LangContext";
import { cn } from "@/lib/utils";
import {
  Briefcase, Radar, Zap, MessageSquare, Building2,
  FileText, Network, ArrowRight, Activity, CheckCircle2,
  AlertTriangle, Clock, Circle,
} from "lucide-react";
import type { Issue } from "@paperclipai/shared";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
};

function statusColor(status: string) {
  switch (status) {
    case "done": return "text-green-600 dark:text-green-400";
    case "in_progress": return "text-blue-600 dark:text-blue-400";
    case "todo": return "text-muted-foreground";
    case "backlog": return "text-muted-foreground";
    case "cancelled": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, React.ElementType> = {
    done: CheckCircle2,
    in_progress: Activity,
    todo: Clock,
    backlog: Circle,
  };
  const Icon = map[status] ?? Circle;
  return <Icon className={cn("w-3.5 h-3.5 shrink-0", statusColor(status))} />;
}

function priorityBadge(priority: string) {
  switch (priority) {
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
    case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
    default: return "bg-muted text-muted-foreground";
  }
}

interface CapabilityCardProps {
  capKey: CapabilityKey;
  issues: Issue[];
  liveCount: number;
}

function CapabilityCard({ capKey, issues, liveCount }: CapabilityCardProps) {
  const { t, isAr } = useLang();
  const cap = CAPABILITIES.find((c) => c.key === capKey)!;
  const Icon = iconMap[cap.icon] ?? FileText;
  const done = issues.filter((i) => i.status === "done").length;
  const inProgress = issues.filter((i) => i.status === "in_progress").length;
  const recent = [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  return (
    <Link to={`/twin/${capKey}`} className="block group">
      <div className="border border-border rounded-lg bg-card hover:border-primary/30 hover:shadow-sm transition-all p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ backgroundColor: cap.color + "20" }}
            >
              <Icon className="w-4 h-4" style={{ color: cap.color }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                {isAr ? cap.labelAr : cap.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(`Sprint ${cap.sprint}`, `السباق ${cap.sprint}`)}
              </p>
            </div>
          </div>
          {liveCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {liveCount} {t("live", "نشط")}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="flex gap-4 mb-3">
          <div>
            <div className="text-lg font-bold text-foreground">{issues.length}</div>
            <div className="text-xs text-muted-foreground">{t("Issues", "المهام")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">{done}</div>
            <div className="text-xs text-muted-foreground">{t("Done", "مكتمل")}</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-600">{inProgress}</div>
            <div className="text-xs text-muted-foreground">{t("Active", "نشط")}</div>
          </div>
        </div>

        {/* Recent issues */}
        <div className="space-y-1.5">
          {recent.map((issue) => (
            <div key={issue.id} className="flex items-center gap-2 text-xs">
              <StatusDot status={issue.status} />
              <span className="truncate text-muted-foreground">{issue.title}</span>
              {issue.priority && (
                <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-xs", priorityBadge(issue.priority))}>
                  {issue.priority}
                </span>
              )}
            </div>
          ))}
          {recent.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("No issues yet", "لا توجد مهام بعد")}</p>
          )}
        </div>

        {/* View arrow */}
        <div className="flex justify-end mt-3">
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Link>
  );
}

function EscalationBanner({ issues }: { issues: Issue[] }) {
  const { t } = useLang();
  const urgent = issues.filter((i) => i.priority === "critical" && i.status !== "done");
  if (urgent.length === 0) return null;
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 mb-6">
      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          {t(`${urgent.length} urgent issue${urgent.length > 1 ? "s" : ""} require attention`, `${urgent.length} مهمة عاجلة تتطلب الانتباه`)}
        </p>
        <div className="mt-1 space-y-0.5">
          {urgent.slice(0, 3).map((i) => (
            <p key={i.id} className="text-xs text-red-600 dark:text-red-400 truncate">{i.title}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TwinDashboard() {
  const { t, isAr } = useLang();

  const { data: allIssues = [] } = useQuery({
    queryKey: ["twin", "issues", "all"],
    queryFn: () => twinApi.getAllIssues(),
    refetchInterval: 30_000,
  });

  const { data: liveRuns = [] } = useQuery({
    queryKey: ["twin", "live-runs"],
    queryFn: () => twinApi.getLiveRuns(),
    refetchInterval: 10_000,
  });

  const totalIssues = allIssues.length;
  const doneIssues = allIssues.filter((i) => i.status === "done").length;
  const activeIssues = allIssues.filter((i) => i.status === "in_progress").length;
  const liveRunCount = liveRuns.length;

  const issuesByProject: Record<string, Issue[]> = {};
  for (const cap of CAPABILITIES) {
    issuesByProject[cap.key] = allIssues.filter((i) => i.projectId === cap.projectId);
  }

  const liveByProject: Record<string, number> = {};
  for (const cap of CAPABILITIES) {
    const agentIds = new Set(
      allIssues.filter((i) => i.projectId === cap.projectId).map((i) => i.assigneeAgentId)
    );
    liveByProject[cap.key] = liveRuns.filter((r) => agentIds.has(r.agentId)).length;
  }

  const today = new Date().toLocaleDateString(isAr ? "ar-JO" : "en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <p className="text-xs text-muted-foreground mb-1">{today}</p>
        <h1 className="text-2xl font-bold text-foreground">
          {t("Minister Digital Twin", "التوأم الرقمي للوزير")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Ministerial intelligence system — Jordan Public Sector Development",
            "نظام الاستخبارات الوزارية — وزارة تطوير القطاع العام · الأردن",
          )}
        </p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: t("Capabilities", "القدرات"), value: "7", sub: t("All operational", "جميعها تعمل") },
          { label: t("Total Issues", "إجمالي المهام"), value: totalIssues, sub: t("Across all sprints", "عبر جميع السباقات") },
          { label: t("Completed", "مكتملة"), value: doneIssues, sub: `${Math.round((doneIssues / Math.max(totalIssues, 1)) * 100)}% ${t("done", "مكتملة")}` },
          { label: t("Live Agents", "عملاء نشطون"), value: liveRunCount, sub: t("Running now", "قيد التشغيل الآن") },
        ].map((m) => (
          <div key={m.label} className="border border-border rounded-lg bg-card p-4">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Escalation banner */}
      <EscalationBanner issues={allIssues} />

      {/* Capability grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CAPABILITIES.map((cap) => (
          <CapabilityCard
            key={cap.key}
            capKey={cap.key}
            issues={issuesByProject[cap.key] ?? []}
            liveCount={liveByProject[cap.key] ?? 0}
          />
        ))}
      </div>

      {/* Live activity strip */}
      {liveRuns.length > 0 && (
        <div className="mt-6 p-4 border border-border rounded-lg bg-card">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Live Agent Activity", "نشاط العملاء الحي")}
            </h2>
          </div>
          <div className="space-y-1.5">
            {liveRuns.slice(0, 6).map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  run.status === "running" ? "bg-blue-500 animate-pulse" : "bg-muted-foreground",
                )} />
                <span className="font-medium text-foreground">{run.agentName}</span>
                <span>·</span>
                <span className="truncate">{run.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
