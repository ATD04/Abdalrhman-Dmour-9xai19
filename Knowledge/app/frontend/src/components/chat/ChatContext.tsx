"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useMemo } from "react";
import { useApp } from "@/components/AppShell";
import { CitationChip } from "@/components/ui";
import {
  CHAT_ACTIVE_CONVERSATION_EVENT,
  ChatConversationRecord,
  getActiveConversationId,
  loadConversations,
  setActiveConversationId,
  upsertConversation,
} from "@/lib/chat-history";
import { normalizeOwnerId } from "@/lib/user-context";
import { listSavedAnswers, toggleSavedAnswer } from "@/lib/saved-answers";
import { getServiceBaseUrl, workflowService } from "@/lib/api";
import { parseSseEvent } from "@/lib/sse-events";
import type {
  ChatContextType,
  Citation,
  LoadingProgress,
  MessageMeta,
  Msg,
  PipelineStep,
  SelectedSource,
  SourceRef,
} from "./types";

const ChatContext = createContext<ChatContextType | null>(null);

export function useChatContext(): ChatContextType {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { lang, role, isLoggedIn, userEmail, sidebarCollapsed } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sessionId, setSessionId] = useState(() => `sess-${Date.now()}`);
  const [activeConversationId, setLocalActiveConversationId] = useState(() => `conv-${Date.now()}`);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"fast" | "thinking">("fast");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set());
  const [selectedSource, setSelectedSource] = useState<SelectedSource | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [selectedMessageForDetails, setSelectedMessageForDetails] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    currentStep: null,
    completedSteps: [],
    chunkCount: 0,
    citationCount: 0,
    reviewWarningSeen: false,
    correctionSeen: false,
    startedAt: null,
    currentLabel: "",
  });
  const [loadingElapsedMs, setLoadingElapsedMs] = useState(0);
  const [thinkingContent, setThinkingContent] = useState("");
  const thinkingContentRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAr = lang === "ar";
  const ownerId = useMemo(() => normalizeOwnerId(isLoggedIn, userEmail), [isLoggedIn, userEmail]);
  const agentBaseUrl = getServiceBaseUrl("agent");
  const isEmptyState = messages.length === 0;

  // ─── Conversation hydration ──────────────────────────────────────
  const hydrateConversationFromStorage = (targetConversationId?: string | null) => {
    const existing = loadConversations(ownerId);
    if (existing.length === 0) {
      setSessionId(`sess-${Date.now()}`);
      setLocalActiveConversationId(`conv-${Date.now()}`);
      setMessages([]);
      setHistoryHydrated(true);
      return;
    }
    const selectedId = targetConversationId || getActiveConversationId(ownerId);
    const selected = existing.find((conv) => conv.id === selectedId) || existing[0];
    setLocalActiveConversationId(selected.id);
    setSessionId(selected.sessionId);
    setMessages(selected.messages as Msg[]);
    setHistoryHydrated(true);
  };

  const createConversationTitle = (msgList: Msg[]) => {
    const firstUser = msgList.find((msg) => msg.role === "user" && msg.content.trim());
    if (!firstUser) return isAr ? "محادثة جديدة" : "New Chat";
    const clean = firstUser.content.replace(/\s+/g, " ").trim();
    return clean.length > 80 ? `${clean.slice(0, 80)}...` : clean;
  };

  // ─── Effects ─────────────────────────────────────────────────────
  useEffect(() => {
    setHistoryHydrated(false);
    hydrateConversationFromStorage();
  }, [ownerId]);

  useEffect(() => {
    const onActiveConversationChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ ownerId?: string; conversationId?: string }>;
      if (customEvent.detail?.ownerId !== ownerId) return;
      const nextConversationId = customEvent.detail?.conversationId;
      if (!nextConversationId || nextConversationId === activeConversationId) return;
      const existsInHistory = loadConversations(ownerId).some((conv) => conv.id === nextConversationId);
      if (!existsInHistory) return;
      hydrateConversationFromStorage(nextConversationId);
    };
    window.addEventListener(CHAT_ACTIVE_CONVERSATION_EVENT, onActiveConversationChanged as EventListener);
    return () => window.removeEventListener(CHAT_ACTIVE_CONVERSATION_EVENT, onActiveConversationChanged as EventListener);
  }, [ownerId, activeConversationId]);

  useEffect(() => {
    const saved = listSavedAnswers(ownerId);
    setSavedMessageIds(new Set(saved.map((item) => item.id)));
  }, [ownerId]);

  useEffect(() => {
    if (!historyHydrated) return;
    if (messages.length === 0) return;
    const record: ChatConversationRecord = {
      id: activeConversationId,
      sessionId,
      title: createConversationTitle(messages),
      updatedAt: new Date().toISOString(),
      messages,
    };
    upsertConversation(ownerId, record);
    setActiveConversationId(ownerId, activeConversationId);
  }, [historyHydrated, messages, activeConversationId, sessionId, ownerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading || !loadingProgress.startedAt) {
      setLoadingElapsedMs(0);
      return;
    }
    const tick = () => setLoadingElapsedMs(Date.now() - loadingProgress.startedAt!);
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [loading, loadingProgress.startedAt]);

  // ─── Escalation case linking ─────────────────────────────────────
  const attachLatestEscalationCase = async (messageId: string, query: string) => {
    if (!isLoggedIn || !ownerId || ownerId === "guest") return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, caseCreating: true } } : msg
      )
    );

    try {
      const result = await workflowService.getUserCases(ownerId, 20);
      const cases = result?.cases || [];
      const linked =
        cases.find((c) => c.session_id === sessionId && c.query === query) ||
        cases.find((c) => c.session_id === sessionId) ||
        null;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, metadata: { ...msg.metadata, caseId: linked?.case_id, caseCreated: Boolean(linked?.case_id), caseCreating: false } }
            : msg
        )
      );
    } catch (error) {
      console.error("Failed to link escalation case:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, metadata: { ...msg.metadata, caseCreating: false } } : msg
        )
      );
    }
  };

  // ─── Send message (SSE streaming) ───────────────────────────────
  const sendMessage = async (text?: string) => {
    const q = (text || input).trim();
    if (!q) return;
    setInput("");

    const startedAt = performance.now();
    const userMsg: Msg = { id: `u-${Date.now()}`, role: "user", content: q, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setLoadingElapsedMs(0);
    setLoadingProgress({
      currentStep: null, completedSteps: [], chunkCount: 0, citationCount: 0,
      reviewWarningSeen: false, correctionSeen: false, startedAt: Date.now(), currentLabel: "",
    });
    setThinkingContent("");
    thinkingContentRef.current = "";

    const assistantMsgId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date().toISOString(), metadata: {} }]);

    let streamedText = "";
    let metadata: MessageMeta = {};
    let streamChunkEvents = 0;
    let firstChunkAt: number | null = null;
    let streamErrorMessage: string | null = null;
    let streamCompleted = false;

    const mergeCitations = (existing: Citation[] = [], incoming: Citation[] = []): Citation[] => {
      const map = new Map<string, Citation>();
      for (const c of existing) map.set(`${c.source_id}-${c.page}`, c);
      for (const c of incoming) map.set(`${c.source_id}-${c.page}`, c);
      return Array.from(map.values());
    };

    const toSources = (citations: Citation[] = []): SourceRef[] =>
      citations.map((c, idx) => ({ id: String(idx + 1), sourceId: c.source_id, title: c.source_name, ministry: c.source_name, page: c.page, relevance: 1.0 }));

    const updateAssistant = (content: string, nextMeta: MessageMeta, confidence?: number, escalated?: boolean) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content, metadata: nextMeta, confidence, escalated, mode, sources: toSources(nextMeta.citations || []) }
            : msg
        )
      );
    };

    const revealFallbackStreaming = async (currentText: string, answer: string, nextMeta: MessageMeta, confidence?: number, escalated?: boolean) => {
      if (!answer || answer === currentText) { updateAssistant(answer || currentText, nextMeta, confidence, escalated); return; }
      const minLen = Math.min(currentText.length, answer.length);
      let commonPrefixLen = 0;
      while (commonPrefixLen < minLen && currentText[commonPrefixLen] === answer[commonPrefixLen]) commonPrefixLen += 1;
      let seed = "";
      if (answer.startsWith(currentText)) seed = currentText;
      else if (commonPrefixLen >= 24) seed = answer.slice(0, commonPrefixLen);
      const remaining = answer.slice(seed.length);
      const totalChars = remaining.length;
      if (totalChars < 40) { updateAssistant(answer, nextMeta, confidence, escalated); return; }
      const totalMs = Math.min(1400, Math.max(450, Math.round(totalChars * 6)));
      const frameMs = 33;
      const steps = Math.max(1, Math.floor(totalMs / frameMs));
      const charsPerStep = Math.max(1, Math.ceil(totalChars / steps));
      for (let i = charsPerStep; i < totalChars; i += charsPerStep) {
        updateAssistant(seed + remaining.slice(0, i), nextMeta, confidence, escalated);
        await new Promise((resolve) => setTimeout(resolve, frameMs));
      }
      updateAssistant(answer, nextMeta, confidence, escalated);
    };

    try {
      const streamController = new AbortController();
      const FIRST_TOKEN_TIMEOUT_MS = 60000;
      const firstTokenTimeout = window.setTimeout(() => streamController.abort("first-token-timeout"), FIRST_TOKEN_TIMEOUT_MS);

      const response = await fetch(`${agentBaseUrl}/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: streamController.signal,
        body: JSON.stringify({
          query: q, user_type: role, user_id: ownerId,
          mode: mode === "fast" ? "concise" : "detailed",
          session_id: sessionId, language: isAr ? "ar" : "en",
          ...(agentId ? { agent_id: agentId } : {}),
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body reader available");

      let buffer = "";

      const processEvent = async (rawEvent: string) => {
        const parsed = parseSseEvent(rawEvent);
        if (!parsed) return;
        const { eventType, data } = parsed;

        try {
          if (eventType === "metadata") {
            metadata = { ...metadata, response_id: data.response_id || metadata.response_id };
            return;
          }

          if (eventType === "status") {
            const step = data.step as PipelineStep;
            const label = isAr ? data.label_ar : data.label_en;
            setLoadingProgress((prev) => ({
              ...prev, currentStep: step, currentLabel: label || prev.currentLabel,
              completedSteps: prev.currentStep && prev.currentStep !== step ? [...prev.completedSteps, prev.currentStep] : prev.completedSteps,
            }));
            return;
          }

          if (eventType === "thinking" && data.text !== undefined) {
            thinkingContentRef.current += data.text;
            setThinkingContent(thinkingContentRef.current);
            return;
          }

          if (eventType === "transfer") {
            metadata = { ...metadata, transfer: { occurred: true, from_agent: data.from_agent, to_agent: data.to_agent, reason: data.reason } };
            if (data.to_agent) setAgentId(data.to_agent);
            updateAssistant(streamedText, metadata);
            return;
          }

          if (eventType === "chunk" && data.text !== undefined) {
            if (firstChunkAt === null) window.clearTimeout(firstTokenTimeout);
            streamedText += data.text;
            streamChunkEvents += 1;
            if (firstChunkAt === null) firstChunkAt = performance.now();
            metadata = { ...metadata, totalClientMs: performance.now() - startedAt, firstTokenMs: firstChunkAt - startedAt, streamChunkEvents };
            setLoadingProgress((prev) => ({ ...prev, chunkCount: streamChunkEvents }));
            updateAssistant(streamedText, metadata);
          } else if (eventType === "citation") {
            const mergedCitations = mergeCitations(metadata.citations, [data as Citation]);
            metadata = { ...metadata, citations: mergedCitations };
            setLoadingProgress((prev) => ({ ...prev, citationCount: mergedCitations.length }));
            updateAssistant(streamedText, metadata);
          } else if (eventType === "review_warning" && data.text !== undefined) {
            metadata = { ...metadata, review_warning: data.text };
            setLoadingProgress((prev) => ({ ...prev, reviewWarningSeen: true }));
            updateAssistant(streamedText, metadata);
          } else if (eventType === "correction" && data.text !== undefined) {
            metadata = { ...metadata, correction: { text: data.text, label: data.label } };
            setLoadingProgress((prev) => ({ ...prev, correctionSeen: true }));
            if ((data.label === "extractive_fallback" || data.label === "completion_retry") && typeof data.text === "string") {
              const corrected = data.text.trim();
              if (corrected) { await revealFallbackStreaming(streamedText, corrected, metadata, metadata.confidence, metadata.escalated); streamedText = corrected; }
            } else {
              updateAssistant(streamedText, metadata);
            }
          } else if (eventType === "suggestions" && Array.isArray(data.suggestions)) {
            metadata = { ...metadata, suggestions: data.suggestions };
            updateAssistant(streamedText, metadata);
          } else if (eventType === "complete" || data.confidence !== undefined) {
            const totalClientMs = performance.now() - startedAt;
            const finalAnswer = typeof data.answer === "string" && data.answer.trim() ? data.answer : streamedText;
            metadata = {
              ...metadata,
              confidence: data.confidence, citations: mergeCitations(metadata.citations, data.citations || []),
              escalated: data.escalated, escalation_reason: data.escalation_reason,
              escalation_confirmation_required: data.escalation_confirmation_required,
              totalClientMs: (data.timings?.total ?? 0) * 1000 || totalClientMs,
              firstTokenMs: firstChunkAt !== null ? firstChunkAt - startedAt : undefined,
              streamChunkEvents, chunks_used: data.chunks_used, timings: data.timings,
              review_status: data.review_status, review_issues: data.review_issues, path: data.path,
              final_confidence: data.final_confidence, transfer: data.transfer || metadata.transfer,
              response_id: data.response_id || metadata.response_id,
              clarification_requested: data.clarification_requested || false,
              suggestions: data.suggestions || metadata.suggestions || [],
              thinkingContent: thinkingContentRef.current || undefined,
            };
            setLoadingProgress((prev) => ({ ...prev, citationCount: metadata.citations?.length || prev.citationCount }));
            if (finalAnswer && finalAnswer !== streamedText) {
              await revealFallbackStreaming(streamedText, finalAnswer, metadata, data.confidence, data.escalated);
              streamedText = finalAnswer;
            } else {
              updateAssistant(finalAnswer, metadata, data.confidence, data.escalated);
            }
            streamCompleted = true;
            if (data.escalated) void attachLatestEscalationCase(assistantMsgId, q);
          } else if (eventType === "error" || data.error) {
            streamErrorMessage = data.error || "Unknown stream error";
            throw new Error(streamErrorMessage || "Unknown stream error");
          }
        } catch (e) {
          if (e instanceof Error && e.message === streamErrorMessage) throw e;
          console.error("Failed to process SSE event:", parsed, e);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) { buffer += decoder.decode(); break; }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        for (const rawEvent of events) await processEvent(rawEvent);
      }
      if (buffer.trim()) await processEvent(buffer);

      if (!streamCompleted && streamedText.trim()) {
        metadata = { ...metadata, totalClientMs: performance.now() - startedAt, firstTokenMs: firstChunkAt !== null ? firstChunkAt - startedAt : undefined, streamChunkEvents };
        updateAssistant(streamedText, metadata);
      }
      window.clearTimeout(firstTokenTimeout);
    } catch (error) {
      console.error("Streaming error:", error);
      const isAbortTimeout = error instanceof Error && (error.name === "AbortError" || error.message.includes("first-token-timeout"));
      if (streamedText.trim()) {
        metadata = {
          ...metadata, totalClientMs: performance.now() - startedAt,
          firstTokenMs: firstChunkAt !== null ? firstChunkAt - startedAt : undefined, streamChunkEvents,
          review_warning: metadata.review_warning || (isAr ? "تم عرض إجابة جزئية بسبب انقطاع البث." : "Partial answer shown due to stream interruption."),
        };
        updateAssistant(streamedText, metadata);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`, role: "system" as const,
            content: isAbortTimeout
              ? (isAr ? "انتهت مهلة الاستجابة. حاول مرة أخرى." : "Response timed out. Please try again.")
              : error instanceof Error && error.message
              ? (isAr ? `خطأ في البث: ${error.message}` : `Streaming error: ${error.message}`)
              : (isAr ? "تعذر الاتصال بالخادم حالياً." : "Server connection failed."),
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      setLoadingProgress((prev) => ({ ...prev, startedAt: null }));
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleNewChat = () => {
    const nextConversationId = `conv-${Date.now()}`;
    const nextSessionId = `sess-${Date.now()}`;
    setLoading(false);
    setInput("");
    setLocalActiveConversationId(nextConversationId);
    setSessionId(nextSessionId);
    setMessages([]);
    setSelectedSource(null);
    setDetailsPanelOpen(false);
    setSelectedMessageForDetails(null);
    setHistoryHydrated(true);
    setActiveConversationId(ownerId, nextConversationId);
  };

  const findUserQuestionForAssistant = (assistantIndex: number): string => {
    for (let i = assistantIndex - 1; i >= 0; i -= 1) {
      if (messages[i]?.role === "user") return messages[i].content;
    }
    return "";
  };

  const onToggleSave = (msg: Msg, index: number) => {
    if (msg.role !== "assistant") return;
    const question = findUserQuestionForAssistant(index);
    const saved = toggleSavedAnswer(ownerId, {
      id: msg.id, question, answer: msg.content,
      confidence: msg.confidence, citations: msg.metadata?.citations,
    });
    setSavedMessageIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(msg.id); else next.delete(msg.id);
      return next;
    });
  };

  const openSourceViewer = (source?: SourceRef) => {
    if (!source) return;
    setSelectedSource({ sourceId: source.sourceId, sourceName: source.title, page: source.page || 1 });
  };

  const openCitationViewer = (citation: Citation) => {
    setSelectedSource({ sourceId: citation.source_id, sourceName: citation.source_name, page: citation.page || 1 });
  };

  const openDetailsPanel = (messageId: string) => {
    setSelectedMessageForDetails(messageId);
    setDetailsPanelOpen(true);
  };

  const closeDetailsPanel = () => {
    setDetailsPanelOpen(false);
    setSelectedMessageForDetails(null);
  };

  const formatContent = (content: string, sources?: SourceRef[]) => {
    const parts = content.split(/(\[.*?\]|\*\*.*?\*\*|_.*?_)/g);
    return parts.map((part, i) => {
      if (part.match(/^\[\d+\]$/)) {
        const num = part.replace(/\[|\]/g, "");
        const src = sources?.find((s) => s.id === num);
        return <CitationChip key={i} id={num} title={src?.title} page={src?.page} onClick={() => openSourceViewer(src)} />;
      }
      if (part.match(/^\*\*.*\*\*$/)) return <strong key={i} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });
  };

  const confidenceLabel = (value: number) => {
    if (!isAr) return undefined;
    if (value >= 0.75) return "عالي";
    if (value >= 0.45) return "متوسط";
    return "منخفض";
  };

  const value: ChatContextType = {
    messages, input, setInput, mode, setMode, agentId, setAgentId,
    loading, loadingProgress, loadingElapsedMs, thinkingContent,
    selectedSource, setSelectedSource, detailsPanelOpen,
    selectedMessageForDetails, savedMessageIds, expandedCitations,
    setExpandedCitations, isEmptyState,
    sendMessage, handleKeyDown, handleNewChat, onToggleSave,
    openSourceViewer, openCitationViewer, openDetailsPanel, closeDetailsPanel,
    formatContent, confidenceLabel,
    bottomRef, textareaRef,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
