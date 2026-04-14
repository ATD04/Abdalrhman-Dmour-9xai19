"use client";

import { useChatContext } from "./ChatContext";
import { useApp } from "@/components/AppShell";
import { getServiceBaseUrl } from "@/lib/api";
import { X } from "lucide-react";

export function SourceViewerPanel() {
  const { selectedSource, setSelectedSource } = useChatContext();
  const { lang } = useApp();
  const isAr = lang === "ar";
  const knowledgeBaseUrl = getServiceBaseUrl("knowledge");

  if (!selectedSource) return null;

  return (
    <div className="chat-source-panel" style={{ flex: "0 0 38%", minWidth: 360, background: "var(--bg-surface)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedSource.sourceName}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {isAr ? `صفحة ${selectedSource.page}` : `Page ${selectedSource.page}`}
          </div>
        </div>
        <button
          onClick={() => setSelectedSource(null)}
          style={{ border: "1px solid var(--border-subtle)", background: "var(--bg-subtle)", borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
        <img
          src={`${knowledgeBaseUrl}/sources/${selectedSource.sourceId}/page/${selectedSource.page}`}
          alt="source page preview"
          style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "#fff" }}
        />
      </div>
    </div>
  );
}
