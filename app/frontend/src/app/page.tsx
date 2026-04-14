"use client";

import { AppShell, useApp } from "@/components/AppShell";
import { ResponseDetailsPanel } from "@/components/ResponseDetailsPanel";
import {
  ChatProvider,
  useChatContext,
  ChatMessageList,
  ChatInputBar,
  SourceViewerPanel,
} from "@/components/chat";
import { motion } from "framer-motion";
import { Zap, Brain, Plus } from "lucide-react";

const WELCOME_TITLES = {
  citizen: { en: "How can I help you today?", ar: "كيف يمكنني مساعدتك اليوم؟" },
  operator: { en: "Search knowledge base or review queries", ar: "ابحث في قاعدة المعرفة أو راجع الاستفسارات" },
  admin: { en: "Ask anything about platform operations", ar: "اسأل عن أي شيء يتعلق بعمليات المنصة" },
};

function ChatPageInner() {
  const { lang, role, sidebarCollapsed } = useApp();
  const isAr = lang === "ar";
  const {
    isEmptyState, selectedSource, detailsPanelOpen,
    selectedMessageForDetails, messages, mode, setMode,
    agentId, setAgentId, handleNewChat, closeDetailsPanel,
    input, setInput, handleKeyDown, sendMessage, loading, textareaRef,
  } = useChatContext();

  const selectedMsg = selectedMessageForDetails
    ? messages.find((m) => m.id === selectedMessageForDetails)
    : null;

  return (
    <AppShell title={isAr ? "المساعد الذكي" : "AI Assistant"}>
      <div className="chat-home-shell" style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
        {/* Main chat column */}
        <div
          className="chat-home-main-column"
          style={{
            flex: selectedSource ? "0 0 62%" : 1,
            display: "flex", flexDirection: "column", minWidth: 0,
            borderRight: selectedSource ? "1px solid var(--border-subtle)" : "none",
          }}
        >
          {/* Mode bar */}
          <div className="chat-mode-bar chat-home-mode-bar">
            <div className="mode-toggle-group">
              {(["fast", "thinking"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} className={`mode-toggle-btn ${mode === m ? "active" : ""}`} data-mode={m}>
                  {m === "fast" ? <Zap size={14} /> : <Brain size={14} />}
                  <span>{m === "fast" ? (isAr ? "سريع" : "Fast") : (isAr ? "تفكير" : "Think")}</span>
                </button>
              ))}
            </div>
            <select value={agentId ?? ""} onChange={(e) => setAgentId(e.target.value || null)} className="agent-select">
              <option value="">{isAr ? "جميع الوزارات" : "All Ministries"}</option>
              <option value="CIVIL_SERVICE_AGENT">{isAr ? "ديوان الخدمة المدنية" : "Civil Service Bureau"}</option>
              <option value="LABOR_AGENT">{isAr ? "وزارة العمل" : "Ministry of Labor"}</option>
              <option value="JUSTICE_AGENT">{isAr ? "وزارة العدل" : "Ministry of Justice"}</option>
              <option value="CIVIL_STATUS_AGENT">{isAr ? "الأحوال المدنية" : "Civil Status Dept."}</option>
              <option value="DIGITAL_ECONOMY_AGENT">{isAr ? "الاقتصاد الرقمي والريادة" : "Digital Economy & Entrepreneurship"}</option>
            </select>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={handleNewChat} className="chat-home-new-chat-btn inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium">
              <Plus size={12} />
              {isAr ? "محادثة جديدة" : "New Chat"}
            </button>
          </div>

          {/* Messages area */}
          <div
            className="chat-home-messages"
            style={{
              flex: 1, overflowY: "auto",
              padding: isEmptyState ? "20px 24px" : "20px 0",
              display: "flex", flexDirection: "column",
              justifyContent: isEmptyState ? "center" : "flex-start",
              alignItems: isEmptyState ? "center" : "stretch",
            }}
            dir={isAr ? "rtl" : "ltr"}
          >
            {isEmptyState ? (
              <motion.div className="chat-home-empty" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ width: "100%", maxWidth: 820 }}>
                <motion.div
                  className="chat-home-empty-logo-shell"
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.div
                    className="chat-home-empty-logo-halo"
                    animate={{ scale: [1, 1.06, 1], opacity: [0.55, 0.8, 0.55] }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.img
                    src="/shahem-logo.png"
                    alt={isAr ? "شعار شهم" : "Shahem assistant logo"}
                    className="chat-home-empty-logo-img"
                    animate={{ y: [0, -8, 0], rotate: [0, -1, 0, 1, 0] }}
                    transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
                    onError={(e) => { e.currentTarget.src = "/shahem-logo.svg"; }}
                  />
                </motion.div>
                <h2 className="chat-home-empty-title">
                  {WELCOME_TITLES[role]?.[isAr ? "ar" : "en"] || WELCOME_TITLES.citizen[isAr ? "ar" : "en"]}
                </h2>
                {/* Inline input for empty state */}
                <div className="chat-input-container chat-home-input-container chat-home-empty-input-container" dir={isAr ? "rtl" : "ltr"}>
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
                      <button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="chat-send-btn">
                        <Zap size={16} />
                      </button>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 10 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {isAr ? "الإجابات مستمدة من الوثائق الرسمية للوزارات الأردنية" : "Answers are grounded in official Jordanian ministry documents"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <ChatMessageList />
            )}
          </div>

          {/* Bottom input (when messages exist) */}
          {!isEmptyState && <ChatInputBar />}
        </div>

        {/* Source viewer panel */}
        {selectedSource && <SourceViewerPanel />}
      </div>

      {/* Response details panel */}
      {selectedMsg && (
        <ResponseDetailsPanel
          isOpen={detailsPanelOpen}
          onClose={closeDetailsPanel}
          metadata={selectedMsg.metadata}
          responseId={selectedMsg.metadata?.response_id}
          isAr={isAr}
          sidebarCollapsed={sidebarCollapsed}
          sources={selectedMsg.sources}
        />
      )}
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatPageInner />
    </ChatProvider>
  );
}
