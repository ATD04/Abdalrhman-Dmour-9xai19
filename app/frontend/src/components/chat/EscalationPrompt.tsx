"use client";

import { useApp } from "@/components/AppShell";
import { useChatContext } from "./ChatContext";
import type { Msg } from "./types";
import { AlertTriangle, CheckCircle, Link as LinkIcon } from "lucide-react";
import { motion } from "framer-motion";

export function EscalationPrompt({ msg }: { msg: Msg }) {
  const { sendMessage, loading } = useChatContext();
  const { lang } = useApp();
  const isAr = lang === "ar";

  if (msg.metadata?.escalation_confirmation_required && !msg.escalated) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", background: "var(--bg-accent)", border: "1px solid var(--border-light)", borderRadius: 8, marginBottom: 12 }}>
        <AlertTriangle size={16} style={{ color: "var(--info-700)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--info-700)", fontWeight: 700, marginBottom: 6 }}>
            {isAr ? "تأكيد فتح تذكرة" : "Confirm ticket escalation"}
          </div>
          <div style={{ fontSize: 11, color: "var(--info-700)", marginBottom: 10 }}>
            {isAr ? "هل تريد تحويل هذا الطلب إلى موظف مختص؟" : "Do you want to escalate this request to a specialist?"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => sendMessage(isAr ? "نعم" : "yes")}
              disabled={loading}
              style={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--info-700)", background: "var(--info-700)", color: "#FFFFFF", padding: "6px 10px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {isAr ? "نعم، أنشئ تذكرة" : "Yes, create ticket"}
            </button>
            <button
              onClick={() => sendMessage(isAr ? "لا" : "no")}
              disabled={loading}
              style={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--info-100)", background: "#FFFFFF", color: "var(--info-700)", padding: "6px 10px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
            >
              {isAr ? "لا" : "No"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (msg.escalated) {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 14px", background: "var(--bg-accent)", border: "1px solid var(--border-light)", borderRadius: 8, marginBottom: 12 }}>
        <AlertTriangle size={16} style={{ color: "var(--warning-700)", flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "var(--warning-700)", fontWeight: 600, marginBottom: 6 }}>
            {isAr ? "تصعيد للمراجعة اليدوية" : "Escalated for manual review"}
          </div>
          <div style={{ fontSize: 11, color: "var(--warning-700)", marginBottom: 8 }}>
            {isAr ? "تم اكتشاف ثقة منخفضة. تم تصعيد هذا الاستفسار إلى مراجع خبير." : "Low confidence detected. This query has been escalated to a human expert reviewer."}
          </div>
          {msg.metadata?.caseCreated && msg.metadata?.caseId && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
              <CheckCircle size={14} style={{ color: "var(--success-700)", flexShrink: 0 }} />
              <span style={{ color: "var(--success-700)", fontWeight: 600 }}>
                {isAr ? "تم إنشاء حالة للمراجعة" : "Case created for review"}
              </span>
              <a href="/my-tickets" style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 4, color: "var(--info-700)", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid var(--info-700)" }}>
                <LinkIcon size={12} />
                {isAr ? "عرض طلباتي" : "View my requests"}
              </a>
            </div>
          )}
          {msg.metadata?.caseCreating && msg.metadata?.escalated && !msg.metadata?.caseCreated && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--warning-700)" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--warning-700)", borderTopColor: "transparent" }} />
              </motion.div>
              {isAr ? "جاري إنشاء حالة..." : "Creating case..."}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
