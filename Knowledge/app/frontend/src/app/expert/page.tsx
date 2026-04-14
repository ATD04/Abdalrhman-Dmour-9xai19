"use client";
import { AppShell } from "@/components/AppShell";
import { StatCard, ConfidenceBadge, StatusBadge, MinistryTag, PageHeader, Button, EmptyState, SkeletonCard, Alert } from "@/components/ui";
import { workflowService, type CaseRecord } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Ticket, Clock, CheckCircle, AlertTriangle, ChevronRight, MessageSquare, Edit3, Inbox, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { normalizeOwnerId } from "@/lib/user-context";
import { CaseResolutionModal } from "@/components/CaseResolutionModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ExpertDashboard() {
  const { lang, isLoggedIn, userEmail } = useApp();
  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseForResolution, setSelectedCaseForResolution] = useState<CaseRecord | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all cases (not just assigned to current user)
      const response = await workflowService.listCases({ page_size: 50 });
      setCases(response.cases || []);
    } catch (err) {
      console.error("Failed to fetch cases:", err);
      setError(isAr ? "فشل تحميل التذاكر" : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const handleDelete = async (caseId: string) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه التذكرة؟" : "Are you sure you want to delete this ticket?")) return;
    try {
      await workflowService.deleteCase(caseId);
      setCases(prev => prev.filter(c => c.case_id !== caseId));
    } catch (err) {
      console.error("Failed to delete case:", err);
      alert(isAr ? "فشل حذف التذكرة" : "Failed to delete ticket");
    }
  };

  // Calculate stats from real data
  const openCount = cases.filter(c => c.status === "open").length;
  const pendingCount = cases.filter(c => c.status === "pending").length;
  const closedCount = cases.filter(c => c.status === "closed").length;
  const highPriorityCount = cases.filter(c => c.priority === "high" || c.priority === "urgent").length;

  // Only show open/pending cases in the queue
  const queueCases = cases.filter(c => c.status !== "closed").slice(0, 10);

  // Get recent activity (closed cases sorted by resolved_at)
  const recentActivity = cases
    .filter(c => c.status === "closed" && c.resolved_at)
    .sort((a, b) => new Date(b.resolved_at!).getTime() - new Date(a.resolved_at!).getTime())
    .slice(0, 4);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    if (diffHours > 0) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
    return isAr ? "الآن" : "just now";
  };

  return (
    <ProtectedRoute allowed={["operator", "admin"]} requireAuth>
    <AppShell title={isAr ? "مساحة مراجعة الخبراء" : "Expert Review Workspace"}>
      <div className="page-container" style={{ maxWidth: 1200 }}>
        <PageHeader
          title={isAr ? "لوحة تحكم الخبراء" : "Expert Dashboard"}
          subtitle={isAr ? "مراجعة الاستفسارات المصعدة وتقديم إجابات موثقة للمواطنين والموظفين الحكوميين." : "Review escalated queries and provide validated responses for citizens and government staff."}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={fetchCases} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--bg-accent)"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                {isAr ? "تحديث" : "Refresh"}
              </button>
              <Link href="/expert/tickets">
                <Button variant="secondary" size="sm" icon={Inbox}>{isAr ? "قائمة التذاكر" : "Ticket Queue"}</Button>
              </Link>
            </div>
          }
        />

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          <StatCard title={isAr ? "التذاكر المفتوحة" : "Open Tickets"} value={openCount} icon={Ticket} iconColor="var(--info-700)" />
          <StatCard title={isAr ? "قيد المراجعة" : "Pending Review"} value={pendingCount} icon={Clock} iconColor="var(--warning-700)" />
          <StatCard title={isAr ? "تم حلها" : "Resolved"} value={closedCount} icon={CheckCircle} iconColor="var(--success-700)" />
        </div>

        {/* Ticket queue */}
        <div className="surface-card" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div>
              <div className="section-title">{isAr ? "قائمة التذاكر النشطة" : "Active Ticket Queue"}</div>
              <div className="section-subtitle">{isAr ? "في انتظار مراجعة الخبراء والحل" : "Pending expert review and resolution"}</div>
            </div>
            <Link href="/expert/tickets">
              <Button variant="secondary" size="sm">{isAr ? "عرض الكل" : "View All"}</Button>
            </Link>
          </div>

          {loading && queueCases.length === 0 ? (
            <div className="p-6 grid grid-cols-1 gap-4">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </div>
          ) : queueCases.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Ticket}
                title={isAr ? "لا توجد تذاكر نشطة" : "No active tickets"}
                description={isAr ? "ستظهر هنا التذاكر المصعدة" : "Escalated tickets will appear here"}
              />
            </div>
          ) : (
            <table className="enhanced-table">
              <thead>
                <tr>
                  <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "التذكرة" : "Ticket"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "القطاع" : "Sector"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "ثقة الذكاء الاصطناعي" : "AI Confidence"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "الحالة" : "Status"}</th>
                  <th style={{ textAlign: isAr ? "right" : "left" }}>{isAr ? "تاريخ الإنشاء" : "Created"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {queueCases.map(ticket => (
                    <motion.tr
                      key={ticket.case_id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      whileHover={{ backgroundColor: "var(--bg-accent)" }}
                      style={{ cursor: "pointer" }}
                    >
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--primary-700)", marginBottom: 4 }}>
                        #{ticket.case_id.slice(0, 8)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ticket.query}
                      </div>
                    </td>
                    <td><MinistryTag name={ticket.sector_primary || "General"} /></td>
                    <td>
                      {ticket.confidence !== undefined ? (
                        <ConfidenceBadge value={ticket.confidence} />
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                    <td><StatusBadge status={ticket.status} /></td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(ticket.created_at).toLocaleDateString(isAr ? 'ar-JO' : 'en-US')}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 8, justifyContent: isAr ? "flex-start" : "flex-end" }}>
                        {ticket.status !== "closed" && (
                          <button
                            onClick={() => setSelectedCaseForResolution(ticket)}
                            className="btn btn-sm"
                            style={{
                              background: "var(--primary-50)",
                              color: "var(--primary-700)",
                              border: "1px solid var(--primary-200)",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Edit3 size={12} />
                            {isAr ? "حل" : "Resolve"}
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedCaseForResolution(ticket)}
                          className="btn btn-sm"
                          style={{
                            background: "var(--primary-50)",
                            color: "var(--primary-700)",
                            border: "1px solid var(--primary-200)",
                          }}
                        >
                          {isAr ? "فتح" : "Open"} <ChevronRight size={12} style={{ transform: isAr ? "rotate(180deg)" : "none" }} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(ticket.case_id); }}
                          className="btn btn-sm"
                          style={{
                            background: "color-mix(in srgb, var(--error-500) 5%, transparent)",
                            color: "var(--error-600)",
                            border: "1px solid color-mix(in srgb, var(--error-500) 10%, transparent)",
                          }}
                          title={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
            </table>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="surface-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 18 }}>
              {isAr ? "ملخص الحالات" : "Case Summary"}
            </div>
            {[
              { label: isAr ? "إجمالي الحالات" : "Total Cases", value: String(cases.length), color: "var(--primary-700)" },
              { label: isAr ? "معدل الحل" : "Resolution Rate", value: cases.length > 0 ? `${Math.round((closedCount / cases.length) * 100)}%` : "0%", color: "var(--success-500)" },
              { label: isAr ? "مرشحة للأسئلة الشائعة" : "FAQ Candidates", value: String(cases.filter(c => c.is_faq_candidate).length), color: "var(--warning-500)" },
            ].map(item => (
              <div key={item.label} className="metric-item">
                <span className="metric-label">{item.label}</span>
                <span className="metric-value" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className="surface-card" style={{ padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 18 }}>
              {isAr ? "النشاط الأخير" : "Recent Activity"}
            </div>
            {recentActivity.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title={isAr ? "لا يوجد نشاط حديث" : "No recent activity"}
                description={isAr ? "ستظهر هنا الحالات المحلولة مؤخراً" : "Recently resolved cases will appear here"}
              />
            ) : (
              recentActivity.map(item => (
                <div key={item.case_id} className="activity-item">
                  <div className="activity-icon" style={{ background: "var(--success-50)", border: "1px solid var(--success-100)" }}>
                    <CheckCircle size={14} style={{ color: "var(--success-500)" }} />
                  </div>
                  <div className="activity-content">
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      {isAr ? "تم الحل" : "Resolved"}{" "}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--primary-700)", fontWeight: 600 }}>
                      #{item.case_id.slice(0, 8)}
                    </span>
                  </div>
                  <span className="activity-time">
                    {item.resolved_at ? formatTimeAgo(item.resolved_at) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Case Resolution Modal */}
      {selectedCaseForResolution && (
        <CaseResolutionModal
          case={selectedCaseForResolution}
          isOpen={!!selectedCaseForResolution}
          onClose={() => setSelectedCaseForResolution(null)}
          onResolved={(resolved) => {
            setCases(prev =>
              prev.map(c => c.case_id === resolved.case_id ? resolved : c)
            );
            // We don't call setSelectedCaseForResolution(null) here because the modal 
            // handles its own closing after 1.5s to show the success message.
            // When the modal calls onClose, setSelectedCaseForResolution(null) will be triggered.
          }}
          isAr={isAr}
        />
      )}
    </AppShell>
    </ProtectedRoute>
  );
}
