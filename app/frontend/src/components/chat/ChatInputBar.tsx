"use client";

import { useChatContext } from "./ChatContext";
import { useApp } from "@/components/AppShell";
import { Send } from "lucide-react";

export function ChatInputBar() {
  const { input, setInput, handleKeyDown, sendMessage, loading, textareaRef } = useChatContext();
  const { lang } = useApp();
  const isAr = lang === "ar";

  return (
    <div className="chat-input-container chat-home-input-container" dir={isAr ? "rtl" : "ltr"}>
      <div className="chat-input-wrapper">
        <div className="chat-input-box">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAr ? "اكتب سؤالك عن السياسات والقوانين الأردنية..." : "Ask about Jordanian policies, laws, and regulations..."}
            rows={1}
            className="chat-input-textarea"
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 140) + "px";
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="chat-send-btn"
          >
            <Send size={16} />
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {isAr ? "الإجابات مستمدة من الوثائق الرسمية للوزارات الأردنية" : "Answers are grounded in official Jordanian ministry documents"}
          </span>
        </div>
      </div>
    </div>
  );
}
