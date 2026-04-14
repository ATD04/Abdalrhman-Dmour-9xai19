"use client";

import { useChatContext } from "./ChatContext";
import { useApp } from "@/components/AppShell";
import { useMemo } from "react";
import { Zap, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PIPELINE_STEPS } from "./types";

export function ChatLoadingPipeline() {
  const { loading, loadingProgress, loadingElapsedMs, mode, thinkingContent } = useChatContext();
  const { lang } = useApp();
  const isAr = lang === "ar";

  const activeLoadingLabel = loadingProgress.currentLabel || (isAr ? "جاري المعالجة" : "Processing...");

  const activeLoadingDetail = useMemo(() => {
    const step = loadingProgress.currentStep;
    if (!step) return isAr ? "جاري الاتصال..." : "Connecting...";
    if (step === "generate" && loadingProgress.chunkCount > 0) {
      return isAr ? `تم استلام ${loadingProgress.chunkCount} دفعة نصية حتى الآن.` : `${loadingProgress.chunkCount} stream chunks received so far.`;
    }
    if (step === "post_generation" && loadingProgress.correctionSeen) {
      return isAr ? "تم اكتشاف تصحيح بعد المراجعة." : "A post-review correction was detected.";
    }
    return "";
  }, [loadingProgress.currentStep, isAr, loadingProgress.chunkCount, loadingProgress.correctionSeen]);

  if (!loading) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="chat-loading-live" style={{ marginTop: 4 }}>
      <div className="chat-loading-live-head">
        <div className="chat-loading-live-chip">
          {mode === "thinking" ? <Brain size={12} /> : <Zap size={12} />}
          <span>{mode === "thinking" ? (isAr ? "وضع التفكير" : "Thinking mode") : (isAr ? "الوضع السريع" : "Fast mode")}</span>
        </div>
        <span className="chat-loading-live-time">{(loadingElapsedMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="pipeline-progress-bar">
        {PIPELINE_STEPS.map((step) => {
          const isCompleted = loadingProgress.completedSteps.includes(step);
          const isCurrent = loadingProgress.currentStep === step;
          return <div key={step} className={`pipeline-dot${isCompleted ? " done" : ""}${isCurrent ? " active" : ""}`} />;
        })}
      </div>

      <div className="chat-loading-stage-list">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={loadingProgress.currentStep || "init"}
            initial={{ opacity: 0, x: -10, y: 5 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 10, y: -5 }}
            transition={{ duration: 0.2 }}
            className="chat-loading-stage-item active"
          >
            <div className="chat-loading-stage-dot"><div className="chat-loading-stage-spinner" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="chat-loading-stage-text" style={{ fontSize: "12px", fontWeight: 700 }}>{activeLoadingLabel}</span>
              {activeLoadingDetail && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="chat-loading-stage-detail">{activeLoadingDetail}</motion.span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {mode === "thinking" && thinkingContent && (
        <div className="thinking-inline-preview">
          <span className="thinking-label"><Brain size={10} />{isAr ? "تفكير النموذج..." : "Model thinking..."}</span>
          <span className="thinking-preview-text">{thinkingContent.slice(-200)}</span>
        </div>
      )}
    </motion.div>
  );
}
