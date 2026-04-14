"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Ticket, RefreshCw, UserPlus, Clock3, CheckCircle2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { workflowService, type CaseRecord } from "@/lib/api";
import { CaseResolutionModal } from "@/components/CaseResolutionModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function ExpertTicketsPage() {
  const { lang, userEmail } = useApp();
  const isAr = lang === "ar";
  const [tickets, setTickets] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      // Expert queue should show active escalated cases, not just those explicitly assigned.
      const data = await workflowService.listCases({ page_size: 100 });
      const list = (data.cases || []).filter((item) => item.status !== "closed");
      setTickets(list);
    } catch {
      setError(isAr ? "فشل تحميل قائمة التذاكر" : "Failed to load ticket queue");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const patchLocalCase = (caseId: string, updates: Partial<CaseRecord>) => {
    setTickets((prev) => prev.map((ticket) => (ticket.case_id === caseId ? { ...ticket, ...updates } : ticket)));
  };

  const assignToMe = async (ticket: CaseRecord) => {
    if (!userEmail) return;
    setUpdatingId(ticket.case_id);
    setError(null);
    try {
      const updated = await workflowService.updateCase(ticket.case_id, {
        assigned_to: userEmail,
        status: ticket.status === "open" ? "pending" : ticket.status,
      });
      patchLocalCase(ticket.case_id, updated);
    } catch {
      setError(isAr ? "تعذر إسناد التذكرة" : "Could not assign this ticket");
    } finally {
      setUpdatingId(null);
    }
  };

  const markPending = async (ticket: CaseRecord) => {
    if (ticket.status === "pending") return;
    setUpdatingId(ticket.case_id);
    setError(null);
    try {
      const updated = await workflowService.updateCase(ticket.case_id, { status: "pending" });
      patchLocalCase(ticket.case_id, updated);
    } catch {
      setError(isAr ? "تعذر تحديث الحالة" : "Could not update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (caseId: string) => {
    if (!confirm(isAr ? "هل أنت متأكد من حذف هذه التذكرة؟" : "Are you sure you want to delete this ticket?")) return;
    try {
      await workflowService.deleteCase(caseId);
      setTickets(prev => prev.filter(ticket => ticket.case_id !== caseId));
    } catch {
      setError(isAr ? "فشل حذف التذكرة" : "Failed to delete ticket");
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <ProtectedRoute allowed={["operator", "admin"]} requireAuth>
    <AppShell title={isAr ? "قائمة التذاكر" : "Ticket Queue"}>
      <div className="page-container" style={{ maxWidth: 1120 }}>
        <PageHeader
          title={isAr ? "قائمة تذاكر الخبراء" : "Reviewer Ticket Queue"}
          subtitle={isAr ? "الاستفسارات التي تحتاج تدخلًا بشريًا لضمان الدقة." : "Queries requiring human expert intervention for accuracy."}
          actions={
            <button onClick={fetchQueue} className="flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm hover:bg-stone-50 transition-colors">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          }
        />

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {tickets.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={isAr ? "لا توجد تذاكر نشطة" : "No active tickets"}
            description={isAr ? "ستظهر هنا التذاكر المصعدة النشطة." : "Active escalated tickets will appear here."}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {tickets.map((ticket) => (
                <motion.div
                  key={ticket.case_id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="surface-card-hover p-5"
                >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge status={ticket.status} />
                      <StatusBadge status={ticket.priority === "urgent" ? "critical" : ticket.priority} />
                      <span className="text-xs text-slate-400 font-mono">#{ticket.case_id}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-2">{ticket.query}</h3>
                    <div className="text-xs text-slate-500">
                      {isAr ? "المستخدم" : "User"}: {ticket.user_id || "-"} · {new Date(ticket.created_at).toLocaleString(isAr ? "ar-JO" : "en-US")}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {isAr ? "المعيّن" : "Assigned to"}: {ticket.assigned_to || (isAr ? "غير معيّن" : "Unassigned")}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <button
                      onClick={() => assignToMe(ticket)}
                      disabled={updatingId === ticket.case_id || !userEmail}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <UserPlus size={13} />
                      {isAr ? "إسناد لي" : "Assign to me"}
                    </button>

                    <button
                      onClick={() => markPending(ticket)}
                      disabled={updatingId === ticket.case_id || ticket.status === "pending"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Clock3 size={13} />
                      {isAr ? "قيد المراجعة" : "Mark pending"}
                    </button>

                    <button
                      onClick={() => setSelectedCase(ticket)}
                      disabled={updatingId === ticket.case_id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      {isAr ? "حل وإغلاق" : "Resolve"}
                    </button>

                    <button
                      onClick={() => handleDelete(ticket.case_id)}
                      disabled={updatingId === ticket.case_id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
                      title={isAr ? "حذف" : "Delete"}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        )}

        {selectedCase && (
          <CaseResolutionModal
            case={selectedCase}
            isOpen={Boolean(selectedCase)}
            onClose={() => setSelectedCase(null)}
            isAr={isAr}
            actor={userEmail || "expert-user"}
            onResolved={(resolved) => {
              // Optimistically reflect closure in queue and refetch for consistency.
              setTickets((prev) => prev.filter((ticket) => ticket.case_id !== resolved.case_id));
              fetchQueue();
            }}
          />
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
