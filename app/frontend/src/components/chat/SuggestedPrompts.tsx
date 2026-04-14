"use client";

import { useChatContext } from "./ChatContext";
import { useApp } from "@/components/AppShell";

export function SuggestedPrompts({ suggestions }: { suggestions: string[] }) {
  const { sendMessage, loading } = useChatContext();
  const { lang } = useApp();

  if (!suggestions.length || loading) return null;

  return (
    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
      {suggestions.map((suggestion, sIdx) => (
        <button
          key={sIdx}
          onClick={() => sendMessage(suggestion)}
          disabled={loading}
          style={{
            fontSize: 12, padding: "6px 14px", borderRadius: 24,
            border: "1px solid var(--teal-200, #99F6E4)",
            background: "var(--teal-50, #F0FDFA)",
            color: "var(--teal-700, #0F766E)",
            fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease", lineHeight: 1.4,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--teal-100, #CCFBF1)"; e.currentTarget.style.borderColor = "var(--teal-300, #5EEAD4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--teal-50, #F0FDFA)"; e.currentTarget.style.borderColor = "var(--teal-200, #99F6E4)"; }}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
