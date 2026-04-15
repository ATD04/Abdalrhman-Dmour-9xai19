import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { twinApi } from "./api";
import { CAPABILITIES, AGENTS, type CapabilityKey } from "./config";
import { useLang } from "./LangContext";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, Activity, Clock, Circle, Play, RefreshCw,
  ChevronDown, ChevronRight, MessageSquare, ExternalLink, AlertTriangle,
  Briefcase, Radar, Zap, FileText, Building2, Network, RotateCcw,
} from "lucide-react";
import type { Issue } from "@paperclipai/shared";
import { MarkdownBody } from "@/components/MarkdownBody";

const iconMap: Record<string, React.ElementType> = {
  Briefcase, Radar, Zap, MessageSquare, Building2, FileText, Network,
};

// Lead agent IDs per capability — maps to the "chief" agent to wake
const LEAD_AGENTS: Record<CapabilityKey, string> = {
  cos:          AGENTS.cos,
  radar:        AGENTS.radarChief,
  friction:     AGENTS.frictionChief,
  voice:        AGENTS.voiceChief,
  readiness:    AGENTS.readinessChief,
  policy:       AGENTS.policyChief,
  coordination: AGENTS.coordChief,
};

function statusLabel(status: string, isAr: boolean) {
  const map: Record<string, [string, string]> = {
    done:        ["Done", "مكتمل"],
    in_progress: ["In Progress", "قيد التنفيذ"],
    todo:        ["To Do", "للتنفيذ"],
    backlog:     ["Backlog", "قائمة الانتظار"],
    cancelled:   ["Cancelled", "ملغي"],
  };
  const [en, ar] = map[status] ?? [status, status];
  return isAr ? ar : en;
}

function statusIcon(status: string) {
  switch (status) {
    case "done":        return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    case "in_progress": return <Activity className="w-3.5 h-3.5 text-blue-500" />;
    case "todo":        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
    default:            return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function priorityColor(priority: string) {
  switch (priority) {
    case "critical": return "text-red-600 bg-red-50 dark:bg-red-950";
    case "high":     return "text-orange-600 bg-orange-50 dark:bg-orange-950";
    case "medium":   return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950";
    default:         return "text-muted-foreground bg-muted";
  }
}

function IssueCard({ issue, companyPrefix }: { issue: Issue; companyPrefix?: string }) {
  const { t, isAr } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["twin", "comments", issue.id],
    queryFn: () => twinApi.getIssueComments(issue.id),
    enabled: showComments,
  });

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Issue header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="mt-0.5 shrink-0">{statusIcon(issue.status)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {companyPrefix && (
              <span className="text-xs font-mono text-muted-foreground shrink-0">
                {companyPrefix}
              </span>
            )}
            <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {statusLabel(issue.status, isAr)}
            </span>
            {issue.priority && (
              <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-xs", priorityColor(issue.priority))}>
                {isAr ? ({ critical: "حرج", high: "عالي", medium: "متوسط", low: "منخفض" } as Record<string, string>)[issue.priority] ?? issue.priority : issue.priority}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {issue.description && (
            <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-muted-foreground">
                <MarkdownBody>{issue.description.slice(0, 600) + (issue.description.length > 600 ? "…" : "")}</MarkdownBody>
            </div>
          )}

          {/* Comment toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowComments((v) => !v); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {showComments
              ? t("Hide outputs", "إخفاء المخرجات")
              : t("Show agent outputs", "عرض مخرجات العميل")}
          </button>

          {showComments && comments.length > 0 && (
            <div className="mt-3 space-y-3">
              {comments.slice(-3).map((comment) => (
                <div key={comment.id} className="bg-muted/40 rounded-md p-3">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                    <MarkdownBody>{comment.body}</MarkdownBody>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showComments && comments.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {t("No agent outputs yet", "لا توجد مخرجات بعد")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface TriggerButtonProps {
  capKey: CapabilityKey;
  projectId: string;
}

function NewIssuePanel({ capKey, projectId, onClose }: { capKey: CapabilityKey; projectId: string; onClose: () => void }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");

  const leadAgentId = LEAD_AGENTS[capKey];

  const createMutation = useMutation({
    mutationFn: () => twinApi.createIssue({
      title,
      description,
      priority,
      projectId,
      assigneeAgentId: leadAgentId,
    }),
    onSuccess: async (issue) => {
      qc.invalidateQueries({ queryKey: ["twin", "issues"] });
      // Wake the lead agent
      await twinApi.wakeAgent(leadAgentId, { issueId: issue.id });
      onClose();
    },
  });

  return (
    <div className="border border-border rounded-lg bg-card p-4 mt-4">
      <h3 className="text-sm font-semibold mb-3">{t("New Task", "مهمة جديدة")}</h3>
      <div className="space-y-2">
        <input
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t("Task title…", "عنوان المهمة…")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          rows={3}
          placeholder={t("Description (optional)", "الوصف (اختياري)")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <select
          className="px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="urgent">{t("Urgent", "عاجل")}</option>
          <option value="high">{t("High", "عالي")}</option>
          <option value="medium">{t("Medium", "متوسط")}</option>
          <option value="low">{t("Low", "منخفض")}</option>
        </select>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-accent transition-colors"
          >
            {t("Cancel", "إلغاء")}
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
            className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
          >
            {createMutation.isPending && <RotateCcw className="w-3.5 h-3.5 animate-spin" />}
            {t("Create & Run", "إنشاء وتشغيل")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CapabilityPageContent({ capKey }: { capKey: CapabilityKey }) {
  const { t, isAr } = useLang();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [showNewIssue, setShowNewIssue] = useState(false);

  const cap = CAPABILITIES.find((c) => c.key === capKey)!;
  const Icon = iconMap[cap.icon] ?? FileText;
  const leadAgentId = LEAD_AGENTS[capKey];

  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["twin", "issues", capKey],
    queryFn: () => twinApi.getIssues(cap.projectId),
    refetchInterval: 30_000,
  });

  const { data: liveRuns = [] } = useQuery({
    queryKey: ["twin", "live-runs"],
    queryFn: () => twinApi.getLiveRuns(),
    refetchInterval: 10_000,
  });

  const activeRun = liveRuns.find((r) => r.agentId === leadAgentId);

  const wakeupMutation = useMutation({
    mutationFn: () => twinApi.wakeAgent(leadAgentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["twin", "live-runs"] });
    },
  });

  const filters = ["all", "in_progress", "todo", "backlog", "done"];
  const filtered = filter === "all" ? issues : issues.filter((i) => i.status === filter);

  const stats = {
    total: issues.length,
    done: issues.filter((i) => i.status === "done").length,
    active: issues.filter((i) => i.status === "in_progress").length,
    todo: issues.filter((i) => i.status === "todo" || i.status === "backlog").length,
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: cap.color + "20" }}
          >
            <Icon className="w-5 h-5" style={{ color: cap.color }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{isAr ? cap.labelAr : cap.label}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{isAr ? cap.descriptionAr : cap.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeRun ? (
            <span className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 px-2.5 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {t("Agent running", "العميل يعمل")}
            </span>
          ) : (
            <button
              onClick={() => wakeupMutation.mutate()}
              disabled={wakeupMutation.isPending}
              className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50 transition"
            >
              {wakeupMutation.isPending
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <Play className="w-3.5 h-3.5" />}
              {t("Run Agent", "تشغيل العميل")}
            </button>
          )}
          <button
            onClick={() => setShowNewIssue((v) => !v)}
            className="flex items-center gap-1.5 text-xs border border-border px-2.5 py-1.5 rounded-md hover:bg-accent transition"
          >
            + {t("New Task", "مهمة جديدة")}
          </button>
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-md border border-border hover:bg-accent transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: t("Total", "الإجمالي"), value: stats.total },
          { label: t("Done", "مكتمل"), value: stats.done, color: "text-green-600" },
          { label: t("Active", "نشط"), value: stats.active, color: "text-blue-600" },
          { label: t("Pending", "معلق"), value: stats.todo },
        ].map((s) => (
          <div key={s.label} className="border border-border rounded-lg bg-card p-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-xl font-bold mt-0.5", s.color ?? "text-foreground")}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* New issue panel */}
      {showNewIssue && (
        <NewIssuePanel
          capKey={capKey}
          projectId={cap.projectId}
          onClose={() => setShowNewIssue(false)}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full border transition-colors",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            {f === "all" ? t("All", "الكل") : statusLabel(f, isAr)}
            {f !== "all" && (
              <span className="ml-1 opacity-60">
                {issues.filter((i) => i.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Issues list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{t("No issues in this filter", "لا توجد مهام في هذا التصفية")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      {/* Paperclip link */}
      <div className="mt-6 flex justify-end">
        <a
          href={`/projects/${cap.projectId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t("Open in Paperclip", "فتح في Paperclip")}
        </a>
      </div>
    </div>
  );
}

// Each capability gets its own route component
export function CoSPage()           { return <CapabilityPageContent capKey="cos" />; }
export function RadarPage()         { return <CapabilityPageContent capKey="radar" />; }
export function FrictionPage()      { return <CapabilityPageContent capKey="friction" />; }
export function VoicePage()         { return <CapabilityPageContent capKey="voice" />; }
export function ReadinessPage()     { return <CapabilityPageContent capKey="readiness" />; }
export function PolicyPage()        { return <CapabilityPageContent capKey="policy" />; }
export function CoordinationPage()  { return <CapabilityPageContent capKey="coordination" />; }
