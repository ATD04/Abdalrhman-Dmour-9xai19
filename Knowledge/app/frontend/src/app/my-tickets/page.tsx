"use client";
import { AppShell } from "@/components/AppShell";
import { PageHeader, StatusBadge, MinistryTag, SkeletonCard, Card, Button, StatCard, EmptyState, Input, Select, Alert } from "@/components/ui";
import { useApp } from "@/components/AppShell";
import { Ticket, RefreshCw, Calendar, Clock, AlertTriangle, AlertCircle, Search, ChevronDown, ChevronUp, Trash2, CheckCircle } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeOwnerId } from "@/lib/user-context";
import { workflowService } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";

type WorkflowCase = {
  case_id: string;
  query: string;
  status: 'open' | 'pending' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  escalation_reason: string;
  sector_primary: string;
  created_at: string;
  assigned_to?: string | null;
  resolution_answer?: string | null;
};

export default function MyTicketsPage() {
  const { lang, isLoggedIn, userEmail } = useApp();
  const [tickets, setTickets] = useState<WorkflowCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WorkflowCase["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | WorkflowCase["priority"]>("all");
  const [sortBy, setSortBy] = useState<"recent" | "oldest" | "priority">("recent");
  const [expandedResponses, setExpandedResponses] = useState<Set<string>>(new Set());
  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);

  const fetchTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await workflowService.getUserCases(ownerId, 50);
      setTickets(response.cases ?? []);
    } catch (err) {
      setError(isAr ? "فشل تحميل الطلبات" : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  const toggleResponse = (id: string) => {
    setExpandedResponses((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteTicket = async (caseId: string) => {
    if (!window.confirm(isAr ? "هل أنت متأكد من حذف هذا الطلب؟" : "Are you sure you want to delete this request?")) return;
    try {
      await workflowService.deleteCase(caseId);
      setTickets((prev) => prev.filter((t) => t.case_id !== caseId));
    } catch (err) {
      console.error("Failed to delete ticket:", err);
      alert(isAr ? "فشل حذف الطلب. يرجى المحاولة لاحقاً." : "Failed to delete request. Please try again later.");
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [ownerId]);

  const filteredTickets = useMemo(() => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const statusOrder = { open: 0, pending: 1, closed: 2 };
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = tickets.filter((ticket) => {
      const matchesSearch =
        !normalizedSearch ||
        ticket.query.toLowerCase().includes(normalizedSearch) ||
        ticket.case_id.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "priority") {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      const tA = new Date(a.created_at).getTime();
      const tB = new Date(b.created_at).getTime();
      if (sortBy === "oldest") return tA - tB;
      if (tB !== tA) return tB - tA;

      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }, [tickets, search, statusFilter, priorityFilter, sortBy]);

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'pending').length;
  const resolvedCount = tickets.filter(t => t.status === 'closed').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent').length;

  const priorityBadgeClass = (priority: WorkflowCase["priority"]) => {
    if (priority === "urgent") return "bg-red-100 text-red-700 border border-red-200";
    if (priority === "high") return "bg-amber-100 text-amber-700 border border-amber-200";
    if (priority === "medium") return "bg-sky-100 text-sky-700 border border-sky-200";
    return "bg-gray-100 text-gray-700 border border-gray-200";
  };

  const priorityLabel = (priority: WorkflowCase["priority"]) => {
    if (isAr) {
      if (priority === "urgent") return "عاجلة";
      if (priority === "high") return "عالية";
      if (priority === "medium") return "متوسطة";
      return "منخفضة";
    }

    if (priority === "urgent") return "Urgent";
    if (priority === "high") return "High";
    if (priority === "medium") return "Medium";
    return "Low";
  };

  return (
    <ProtectedRoute allowed={["citizen", "admin"]} requireAuth>
    <AppShell title={isAr ? "طلباتي" : "My Requests"}>
      <div className="page-container" style={{ maxWidth: 1180 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <PageHeader
            title={isAr ? "تتبع الطلبات" : "Track Requests"}
            subtitle={isAr
              ? "استعراض حالة الاستفسارات التي تم تصعيدها للمراجعة."
              : "Monitor the status of inquiries escalated for expert review."}
            actions={
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fetchTickets()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-300 text-sm font-medium bg-white hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {isAr ? "تحديث" : "Refresh"}
              </motion.button>
            }
          />
        </motion.div>

        {tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5"
          >
            <StatCard
              title={isAr ? "إجمالي الطلبات" : "Total Requests"}
              value={tickets.length}
              icon={Ticket}
              iconColor="var(--info-700)"
            />
            <StatCard
              title={isAr ? "قيد المراجعة" : "In Review"}
              value={openCount}
              icon={Clock}
              iconColor="var(--warning-700)"
            />
            <StatCard
              title={isAr ? "مُجابة" : "Resolved"}
              value={resolvedCount}
              icon={CheckCircle}
              iconColor="var(--success-700)"
              className="sm:col-span-2 xl:col-span-1"
            />
          </motion.div>
        )}

        {tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-5"
          >
            <Card padding="none" className="p-4">
              <div className="space-y-3">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={isAr ? "ابحث بالنص أو رقم الطلب" : "Search by text or request ID"}
                  icon={Search}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | WorkflowCase["status"])}
                    options={[
                      { value: "all", label: isAr ? "كل الحالات" : "All statuses" },
                      { value: "open", label: isAr ? "مفتوحة" : "Open" },
                      { value: "pending", label: isAr ? "معلقة" : "Pending" },
                      { value: "closed", label: isAr ? "مغلقة" : "Closed" },
                    ]}
                  />

                  <Select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value as "all" | WorkflowCase["priority"])}
                    options={[
                      { value: "all", label: isAr ? "كل الأولويات" : "All priorities" },
                      { value: "urgent", label: isAr ? "عاجلة" : "Urgent" },
                      { value: "high", label: isAr ? "عالية" : "High" },
                      { value: "medium", label: isAr ? "متوسطة" : "Medium" },
                      { value: "low", label: isAr ? "منخفضة" : "Low" },
                    ]}
                  />

                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "recent" | "oldest" | "priority")}
                    options={[
                      { value: "recent", label: isAr ? "الأحدث أولاً" : "Newest first" },
                      { value: "oldest", label: isAr ? "الأقدم أولاً" : "Oldest first" },
                      { value: "priority", label: isAr ? "حسب الأولوية" : "By priority" },
                    ]}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium" style={{ color: "var(--text-secondary)", background: "var(--bg-subtle)" }}>
                    {isAr ? "المعروض" : "Shown"}: {filteredTickets.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                    {isAr ? "العاجلة" : "Urgent"}: {urgentCount}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Alert variant="error">
              {error}
            </Alert>
          </motion.div>
        )}

        {loading && filteredTickets.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title={tickets.length === 0
              ? (isAr ? "لا توجد طلبات حالياً" : "No requests yet")
              : (isAr ? "لا توجد نتائج مطابقة" : "No matching results")}
            description={tickets.length === 0
              ? (isAr ? "عند تصعيد أي استفسار سيظهر هنا مع حالته وتفاصيل المراجعة." : "Escalated inquiries will appear here with their status and review details.")
              : (isAr ? "جرّب تعديل الفلاتر أو نص البحث لعرض نتائج مختلفة." : "Try changing filters or search text to see different results.")}
          />
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredTickets.map((ticket, idx) => (
                <motion.div
                  key={ticket.case_id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                  transition={{ duration: 0.2 }}
                >
                <Card
                  hover
                  className={`transition-all duration-200 ${
                    ticket.status === 'closed'
                      ? 'opacity-80 bg-slate-50'
                      : ticket.status === 'open'
                      ? isAr
                        ? 'border-r-4 border-r-sky-500 bg-sky-50/40'
                        : 'border-l-4 border-l-sky-500 bg-sky-50/40'
                      : isAr
                        ? 'border-r-4 border-r-amber-500 bg-amber-50/40'
                        : 'border-l-4 border-l-amber-500 bg-amber-50/40'
                  } overflow-hidden`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:justify-between">
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={ticket.status} />
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${priorityBadgeClass(ticket.priority)}`}>
                          {ticket.priority === "urgent" && <AlertCircle size={12} />}
                          {priorityLabel(ticket.priority)}
                        </span>

                        {ticket.status === 'closed' && (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: "var(--success-700)", background: "var(--teal-light, #f0fafa)" }}>
                            {isAr ? 'تمت المعالجة' : 'Resolved'}
                          </span>
                        )}

                        <span className={`text-xs font-mono text-gray-400 ${isAr ? "mr-auto" : "ml-auto"}`}>#{ticket.case_id.slice(0, 8)}</span>
                      </div>

                      <h3 className="font-semibold text-base leading-7 break-words" style={{ color: "var(--text-primary)" }}>
                        {ticket.query}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="flex-shrink-0" />
                          <span>{new Date(ticket.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="flex-shrink-0" />
                          <span>{new Date(ticket.created_at).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                        </div>
                        <MinistryTag name={ticket.sector_primary} />
                        {ticket.assigned_to && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                            {isAr ? "المراجع" : "Reviewer"}: {ticket.assigned_to.length > 20 ? ticket.assigned_to.slice(0, 17) + '...' : ticket.assigned_to}
                          </span>
                        )}
                      </div>

                      {ticket.escalation_reason && (
                        <div className={`text-xs py-2 px-3 italic rounded-md ${isAr ? "border-r-2 border-r-indigo-300" : "border-l-2 border-l-indigo-300"}`} style={{ color: "var(--text-secondary)", background: "var(--bg-subtle)" }}>
                          <span className="font-semibold block mb-0.5" style={{ color: "var(--text-primary)" }}>{isAr ? "سبب التصعيد" : "Escalation reason"}</span>
                          {ticket.escalation_reason}
                        </div>
                      )}

                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {isAr ? "آخر تحديث" : "Last updated"}: {new Date(ticket.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {ticket.resolution_answer && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full lg:w-96 rounded-lg p-4 border flex-shrink-0"
                        style={{ background: "var(--teal-light, #f0fafa)", borderColor: "var(--success-100)" }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--success-700)" }}>
                            {isAr ? "الرد الرسمي" : "Official Response"}
                          </div>
                          <div className="flex items-center gap-3">
                            {ticket.resolution_answer.length > 280 && (
                              <button
                                onClick={() => toggleResponse(ticket.case_id)}
                                className="text-[11px] font-bold flex items-center gap-1 transition-colors hover:opacity-80"
                                style={{ color: "var(--success-700)" }}
                              >
                                {expandedResponses.has(ticket.case_id) ? (
                                  <>
                                    {isAr ? "عرض أقل" : "Show less"}
                                    <ChevronUp size={12} />
                                  </>
                                ) : (
                                  <>
                                    {isAr ? "عرض الكل" : "Show full"}
                                    <ChevronDown size={12} />
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTicket(ticket.case_id)}
                              className="hover:text-red-500 transition-colors"
                              style={{ color: "color-mix(in srgb, var(--success-700) 50%, transparent)" }}
                              title={isAr ? "حذف" : "Delete"}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <p className={`text-sm leading-relaxed ${expandedResponses.has(ticket.case_id) ? "" : "line-clamp-6"}`} style={{ color: "var(--success-700)" }}>
                          {ticket.resolution_answer}
                        </p>
                      </motion.div>
                    )}

                    {!ticket.resolution_answer && (
                      <div className="flex items-start">
                        <button
                          onClick={() => handleDeleteTicket(ticket.case_id)}
                          className="p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                          title={isAr ? "حذف" : "Delete"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        )}
      </div>
    </AppShell>
    </ProtectedRoute>
  );
}
