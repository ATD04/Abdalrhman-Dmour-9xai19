"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3, Zap, Shield, Link2 } from "lucide-react";
import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { agentService } from "@/lib/api";
import { useFocusTrap } from "@/lib/accessibility-hooks";

interface MessageMeta {
  confidence?: number;
  chunks_used?: number;
  totalClientMs?: number;
  firstTokenMs?: number;
  streamChunkEvents?: number;
  timings?: Record<string, number>;
  escalated?: boolean;
  citations?: any[];
}

interface ResponseDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: MessageMeta | undefined;
  responseId: string | undefined;
  isAr: boolean;
  sidebarCollapsed?: boolean;
  sources?: any[];
}

export function ResponseDetailsPanel({
  isOpen,
  onClose,
  metadata,
  responseId,
  isAr,
  sidebarCollapsed = false,
  sources = []
}: ResponseDetailsPanelProps) {
  const [confidenceBreakdown, setConfidenceBreakdown] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const panelRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (isOpen && responseId && !confidenceBreakdown) {
      fetchConfidenceBreakdown();
    }
  }, [isOpen, responseId]);

  const fetchConfidenceBreakdown = async () => {
    if (!responseId) return;
    setLoading(true);
    try {
      const data = await agentService.getConfidence(responseId);
      setConfidenceBreakdown(data.breakdown || {});
    } catch (err) {
      console.error('Failed to fetch confidence breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  const avgLatencyMs = metadata?.totalClientMs || 0;
  const avgLatencySec = (avgLatencyMs / 1000).toFixed(2);
  const firstTokenMs = metadata?.firstTokenMs ?? 0;
  const firstTokenSec = (firstTokenMs / 1000).toFixed(2);
  const streamChunkEvents = metadata?.streamChunkEvents ?? 0;
  const chunksUsed = metadata?.chunks_used || 0;
  const confidence = metadata?.confidence || 0;
  const isEscalated = metadata?.escalated || false;
  const sidebarWidth = sidebarCollapsed ? 72 : 260;
  const topbarHeight = 60;
  const drawerWidth = `min(420px, calc(100vw - ${sidebarWidth + 32}px))`;

  const overlayStyle: CSSProperties = isAr
    ? {
        top: topbarHeight,
        right: sidebarWidth,
        left: 0,
        bottom: 0,
      }
    : {
        top: topbarHeight,
        right: 0,
        left: sidebarWidth,
        bottom: 0,
      };

  const panelStyle: CSSProperties = isAr
    ? {
        top: topbarHeight,
        right: sidebarWidth,
        bottom: 0,
        width: drawerWidth,
      }
    : {
        top: topbarHeight,
        right: 0,
        bottom: 0,
        width: drawerWidth,
      };

  // Calculate average source relevance
  const avgRelevance = sources?.length > 0
    ? (sources.reduce((sum: number, s: any) => sum + (s.relevance || 0), 0) / sources.length * 100).toFixed(1)
    : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed bg-black/40 z-[55]"
            style={overlayStyle}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bg-white shadow-xl z-[60] overflow-y-auto flex flex-col"
            style={panelStyle}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="response-details-title"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <h3 id="response-details-title" className="font-bold text-lg" style={{ color: "var(--text-primary)" }}>
                {isAr ? "تفاصيل الاستجابة" : "Response Details"}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-stone-100 rounded-lg transition"
                aria-label={isAr ? "إغلاق" : "Close"}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-5 space-y-5">
              {/* Confidence Score Card */}
              <div
                className="p-4 rounded-xl border"
                style={{
                  background: "var(--primary-50)",
                  borderColor: "var(--primary-100)"
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={16} style={{ color: "var(--primary-700)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "درجة الثقة" : "Confidence Score"}
                    </span>
                  </div>
                </div>
                <div className="text-3xl font-bold" style={{ color: "var(--primary-700)" }}>
                  {(confidence * 100).toFixed(0)}%
                </div>
                <div className="mt-2 w-full bg-primary-100 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${confidence * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full"
                    style={{ background: "linear-gradient(90deg, var(--primary-600), var(--primary-700))" }}
                  />
                </div>
              </div>

              {/* Confidence Breakdown */}
              {confidenceBreakdown && Object.keys(confidenceBreakdown).length > 0 && (
                <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    {isAr ? "تفصيل الثقة" : "Confidence Breakdown"}
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(confidenceBreakdown).map(([key, value]) => {
                      const displayKey = key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                      const numValue = typeof value === "number" ? value : 0;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            {displayKey}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${numValue * 100}%` }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="h-full"
                                style={{ background: "var(--primary-600)" }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-right w-8" style={{ color: "var(--primary-700)" }}>
                              {(numValue * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3">
                {/* Chunks Used */}
                <div
                  className="p-3.5 rounded-lg border"
                  style={{
                    background: "var(--info-50)",
                    borderColor: "var(--info-100)"
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Link2 size={14} style={{ color: "var(--info-700)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "أجزاء مستخدمة" : "Chunks Used"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--info-700)" }}>
                    {chunksUsed}
                  </div>
                </div>

                {/* Latency */}
                <div
                  className="p-3.5 rounded-lg border"
                  style={{
                    background: "var(--warning-50)",
                    borderColor: "var(--warning-100)"
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap size={14} style={{ color: "var(--warning-700)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "الاستجابة" : "Latency"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--warning-700)" }}>
                    {avgLatencySec}s
                  </div>
                </div>

                {/* First Token */}
                <div
                  className="p-3.5 rounded-lg border"
                  style={{
                    background: "var(--success-50)",
                    borderColor: "var(--success-100)"
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap size={14} style={{ color: "var(--success-700)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "أول رمز" : "First Token"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--success-700)" }}>
                    {firstTokenSec}s
                  </div>
                </div>

                {/* Stream Chunks */}
                <div
                  className="p-3.5 rounded-lg border"
                  style={{
                    background: "var(--primary-50)",
                    borderColor: "var(--primary-100)"
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Link2 size={14} style={{ color: "var(--primary-700)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                      {isAr ? "دفعات البث" : "Stream Chunks"}
                    </span>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: "var(--primary-700)" }}>
                    {streamChunkEvents}
                  </div>
                </div>
              </div>

              {/* Source Relevance */}
              {sources && sources.length > 0 && (
                <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    {isAr ? "جودة المصادر" : "Source Quality"}
                  </h4>
                  <div
                    className="p-3 rounded-lg border mb-3"
                    style={{
                      background: "var(--success-50)",
                      borderColor: "var(--success-100)"
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                        {isAr ? "متوسط الملاءمة" : "Avg Relevance"}
                      </span>
                      <span className="text-lg font-bold" style={{ color: "var(--success-700)" }}>
                        {avgRelevance}%
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sources.map((src, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg border text-xs"
                        style={{
                          background: "var(--bg-subtle)",
                          borderColor: "var(--border-subtle)"
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium" style={{ color: "var(--text-primary)" }}>
                            {src.title || `Source ${idx + 1}`}
                          </span>
                          <span className="text-right font-semibold" style={{ color: "var(--success-700)" }}>
                            {((src.relevance || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Guardrail Status */}
              {isEscalated && (
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: "var(--error-50)",
                    borderColor: "var(--error-100)"
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={16} style={{ color: "var(--error-700)" }} />
                    <h4 className="text-sm font-semibold" style={{ color: "var(--error-700)" }}>
                      {isAr ? "حالة الضوابط الأمنية" : "Guardrail Status"}
                    </h4>
                  </div>
                  <p className="text-xs" style={{ color: "var(--error-600)" }}>
                    {isAr
                      ? "تم تصعيد هذه الاستجابة لأن درجة الثقة أقل من الحد الأدنى المقبول."
                      : "This response was escalated because confidence score fell below acceptable threshold."}
                  </p>
                </div>
              )}

              {/* Timings Breakdown */}
              {metadata?.timings && Object.keys(metadata.timings).length > 0 && (
                <div className="p-4 rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
                  <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    {isAr ? "تفصيل الأوقات" : "Timing Breakdown"}
                  </h4>
                  <div className="space-y-2 text-xs">
                    {Object.entries(metadata.timings).map(([key, value]) => {
                      const displayKey = key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l) => l.toUpperCase());
                      const ms = typeof value === "number" ? value * 1000 : 0;
                      return (
                        <div key={key} className="flex items-center justify-between">
                          <span style={{ color: "var(--text-secondary)" }}>{displayKey}</span>
                          <span style={{ color: "var(--warning-700)", fontWeight: 600 }}>
                            {ms.toFixed(0)}ms
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
