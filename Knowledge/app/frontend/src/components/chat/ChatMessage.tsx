"use client";

import { useChatContext } from "./ChatContext";
import { useApp } from "@/components/AppShell";
import { ConfidenceBadge } from "@/components/ui";
import { EscalationPrompt } from "./EscalationPrompt";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { Brain, FileText, Star, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import type { Msg, Citation, SourceRef } from "./types";
import { AGENT_LABELS_EN, AGENT_LABELS_AR } from "./types";

export function ChatMessage({ msg, index }: { msg: Msg; index: number }) {
  const {
    savedMessageIds, expandedCitations, setExpandedCitations,
    openSourceViewer, openCitationViewer, onToggleSave,
    formatContent, confidenceLabel, loading, openDetailsPanel,
  } = useChatContext();
  const { lang } = useApp();
  const isAr = lang === "ar";

  if (msg.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 4 }}
      >
        <div className="chat-user-bubble">
          <p style={{ fontSize: 13.5, lineHeight: 1.65 }}>{msg.content}</p>
        </div>
      </motion.div>
    );
  }

  // System error messages
  if (msg.role === "system") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
      >
        <div style={{ fontSize: 13, color: "var(--error-500)", padding: "8px 12px", background: "var(--error-50)", borderRadius: 8, border: "1px solid var(--error-100)" }}>
          {msg.content}
        </div>
      </motion.div>
    );
  }

  // Assistant message
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
    >
      <div style={{ width: "100%" }}>
        {/* Header: logo + mode badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 24, height: 24, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--white)", border: "1px solid var(--border-light)", borderRadius: "6px" }}>
            <img src="/shahem-logo.png" alt="Shahem logo" style={{ width: "80%", height: "80%", objectFit: "contain" }} onError={(e) => { e.currentTarget.src = "/shahem-logo.svg"; }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{isAr ? "شهم" : "Shahem"}</span>
          {msg.mode && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: msg.mode === "thinking" ? "rgba(124,58,237,0.08)" : "rgba(183,121,31,0.08)", color: msg.mode === "thinking" ? "#7C3AED" : "var(--warning-700)", fontWeight: 600 }}>
              {msg.mode === "thinking" ? (isAr ? "⚡ وضع التفكير" : "⚡ Thinking") : (isAr ? "⚡ الوضع السريع" : "⚡ Fast")}
            </span>
          )}
        </div>

        <div className="chat-ai-content" style={{ width: "100%" }}>
          {/* Thinking process */}
          {msg.metadata?.thinkingContent && (
            <details className="thinking-section">
              <summary className="thinking-section-toggle">
                <Brain size={14} />
                <span>{isAr ? "مسار التفكير" : "Thinking process"}</span>
                <span className="thinking-token-count">
                  {msg.metadata.thinkingContent.length > 500 ? `~${Math.round(msg.metadata.thinkingContent.length / 4)} tokens` : ""}
                </span>
              </summary>
              <div className="thinking-section-body">{msg.metadata.thinkingContent}</div>
            </details>
          )}

          {/* Escalation */}
          <EscalationPrompt msg={msg} />

          {/* Content with transfer banner */}
          <div style={{ fontSize: 13.5, lineHeight: 1.78, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {msg.metadata?.transfer?.occurred && (
              <div className="transfer-banner" style={{
                marginBottom: 12, padding: "10px 14px", borderRadius: 8,
                border: "1px solid var(--primary-200)", background: "var(--primary-50, #EFF6FF)",
                display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                color: "var(--primary-700, #1D4ED8)", fontWeight: 600,
              }}>
                <span style={{ fontSize: 16 }}>🔄</span>
                {isAr
                  ? `تم تحويل الاستفسار من ${AGENT_LABELS_AR[msg.metadata.transfer.from_agent] || msg.metadata.transfer.from_agent} إلى ${AGENT_LABELS_AR[msg.metadata.transfer.to_agent] || msg.metadata.transfer.to_agent}`
                  : `Query transferred from ${AGENT_LABELS_EN[msg.metadata.transfer.from_agent] || msg.metadata.transfer.from_agent} to ${AGENT_LABELS_EN[msg.metadata.transfer.to_agent] || msg.metadata.transfer.to_agent}`}
              </div>
            )}
            {formatContent(msg.content, msg.sources as SourceRef[])}
          </div>

          {/* Correction */}
          {msg.metadata?.correction?.text && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--warning-500)", background: "var(--warning-50)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#B45309", marginBottom: 6 }}>
                {isAr ? "تصحيح بعد المراجعة" : "Post-review correction"}{msg.metadata?.correction?.label ? ` • ${msg.metadata.correction.label}` : ""}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.7, color: "#78350F", whiteSpace: "pre-wrap" }}>{msg.metadata.correction.text}</div>
            </div>
          )}

          {/* Review warning */}
          {msg.metadata?.review_warning && (
            <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, border: "1px solid var(--info-100)", background: "var(--info-50)", color: "var(--info-700)", fontSize: 12 }}>
              {msg.metadata.review_warning}
            </div>
          )}

          {/* Suggestions */}
          {msg.metadata?.suggestions && msg.metadata.suggestions.length > 0 && (
            <SuggestedPrompts suggestions={msg.metadata.suggestions} />
          )}

          {/* Footer: confidence + sources + details + save */}
          {(msg.confidence !== undefined || msg.sources) && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {msg.confidence !== undefined && <ConfidenceBadge value={msg.confidence} showBar label={confidenceLabel(msg.confidence)} />}
              {msg.sources && (
                <div style={{ fontSize: 11, color: "var(--navy-royal)", background: "rgba(18,58,99,0.06)", border: "1px solid rgba(18,58,99,0.12)", borderRadius: 5, padding: "3px 8px", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  <FileText size={11} /> {msg.sources.length} {isAr ? "مصادر" : "Sources"}
                </div>
              )}
              <button
                onClick={() => openDetailsPanel(msg.id)}
                style={{ fontSize: 11, color: "var(--text-tertiary)", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 5, padding: "3px 8px", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
              >
                <BarChart3 size={11} />{isAr ? "التفاصيل" : "Details"}
              </button>
              <button
                onClick={() => onToggleSave(msg, index)}
                style={{
                  fontSize: 11,
                  color: savedMessageIds.has(msg.id) ? "var(--warning-700)" : "var(--text-tertiary)",
                  background: savedMessageIds.has(msg.id) ? "var(--warning-50)" : "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)", borderRadius: 5, padding: "3px 8px",
                  fontWeight: 600, display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                }}
              >
                <Star size={11} fill={savedMessageIds.has(msg.id) ? "var(--warning-700)" : "none"} />
                {savedMessageIds.has(msg.id) ? (isAr ? "محفوظ" : "Saved") : (isAr ? "حفظ" : "Save")}
              </button>
            </div>
          )}

          {/* Citations list */}
          {!!msg.metadata?.citations?.length && (() => {
            const grouped = msg.metadata.citations.reduce((acc, c) => {
              if (!acc[c.source_id]) acc[c.source_id] = { citation: c, pages: [] };
              if (!acc[c.source_id].pages.includes(c.page)) acc[c.source_id].pages.push(c.page);
              return acc;
            }, {} as Record<string, { citation: Citation; pages: number[] }>);
            const entries = Object.values(grouped);
            const SHOW_LIMIT = 3;
            const isExpanded = expandedCitations.has(msg.id);
            const visible = isExpanded ? entries : entries.slice(0, SHOW_LIMIT);
            const hidden = entries.length - SHOW_LIMIT;

            return (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {visible.map(({ citation, pages }) => (
                  <div key={citation.source_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: 8, minWidth: 0 }}>
                    <FileText size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {citation.source_name}
                    </span>
                    <div style={{ display: "flex", gap: 3, flexShrink: 0, flexWrap: "wrap" }}>
                      {pages.sort((a, b) => a - b).map((page) => (
                        <button
                          key={page}
                          onClick={() => openCitationViewer({ ...citation, page })}
                          style={{ fontSize: 10, borderRadius: 4, border: "1px solid var(--teal-200, #99F6E4)", padding: "2px 6px", background: "var(--bg-surface)", color: "var(--teal-700, #0F766E)", cursor: "pointer", fontWeight: 600, lineHeight: 1.4 }}
                        >
                          {isAr ? `ص${page}` : `p${page}`}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!isExpanded && hidden > 0 && (
                  <button
                    onClick={() => setExpandedCitations((prev) => new Set([...prev, msg.id]))}
                    style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px dashed var(--border-subtle)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", textAlign: isAr ? "right" : "left" }}
                  >
                    {isAr ? `+ ${hidden} مصادر أخرى` : `+ ${hidden} more sources`}
                  </button>
                )}
                {isExpanded && entries.length > SHOW_LIMIT && (
                  <button
                    onClick={() => setExpandedCitations((prev) => { const s = new Set(prev); s.delete(msg.id); return s; })}
                    style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px dashed var(--border-subtle)", borderRadius: 8, padding: "4px 10px", cursor: "pointer", textAlign: isAr ? "right" : "left" }}
                  >
                    {isAr ? "عرض أقل" : "Show less"}
                  </button>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </motion.div>
  );
}
