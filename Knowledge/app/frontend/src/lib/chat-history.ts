export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  confidence?: number;
  mode?: string;
  escalated?: boolean;
  metadata?: Record<string, unknown>;
  sources?: Array<{
    id: string;
    title: string;
    ministry: string;
    page: number;
    relevance: number;
  }>;
};

export type ChatConversationRecord = {
  id: string;
  sessionId: string;
  title: string;
  updatedAt: string;
  messages: ChatMessageRecord[];
};

const STORAGE_PREFIX = "shahem.chat.history";
const ACTIVE_PREFIX = "shahem.chat.active";
export const CHAT_HISTORY_UPDATED_EVENT = "shahem:chat-history-updated";
export const CHAT_ACTIVE_CONVERSATION_EVENT = "shahem:chat-active-conversation";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitChatEvent(eventName: string, detail: Record<string, string>): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function getChatStorageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}.${ownerId}`;
}

export function getActiveConversationKey(ownerId: string): string {
  return `${ACTIVE_PREFIX}.${ownerId}`;
}

export function loadConversations(ownerId: string): ChatConversationRecord[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(getChatStorageKey(ownerId));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || ""),
        sessionId: String(item.sessionId || ""),
        title: String(item.title || "New Chat"),
        updatedAt: String(item.updatedAt || new Date(0).toISOString()),
        messages: Array.isArray(item.messages) ? item.messages : [],
      }))
      .filter((conv) => conv.id && conv.sessionId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function saveConversations(ownerId: string, conversations: ChatConversationRecord[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(getChatStorageKey(ownerId), JSON.stringify(conversations));
  emitChatEvent(CHAT_HISTORY_UPDATED_EVENT, { ownerId });
}

export function upsertConversation(ownerId: string, conversation: ChatConversationRecord): ChatConversationRecord[] {
  const existing = loadConversations(ownerId);
  const filtered = existing.filter((conv) => conv.id !== conversation.id);
  const next = [conversation, ...filtered].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  saveConversations(ownerId, next);
  return next;
}

export function getActiveConversationId(ownerId: string): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(getActiveConversationKey(ownerId));
}

export function setActiveConversationId(ownerId: string, conversationId: string): void {
  if (!isBrowser()) return;
  const key = getActiveConversationKey(ownerId);
  const previous = window.localStorage.getItem(key);
  if (previous === conversationId) return;

  window.localStorage.setItem(key, conversationId);
  emitChatEvent(CHAT_ACTIVE_CONVERSATION_EVENT, { ownerId, conversationId });
}

export function deleteConversation(ownerId: string, conversationId: string): void {
  const existing = loadConversations(ownerId);
  const next = existing.filter((conv) => conv.id !== conversationId);
  saveConversations(ownerId, next);

  if (getActiveConversationId(ownerId) === conversationId) {
    const nextActive = next[0]?.id || "";
    // If we have a next one, select it; otherwise, clear the active key
    if (nextActive) {
      setActiveConversationId(ownerId, nextActive);
    } else {
      if (isBrowser()) {
        window.localStorage.removeItem(getActiveConversationKey(ownerId));
        emitChatEvent(CHAT_ACTIVE_CONVERSATION_EVENT, { ownerId, conversationId: "" });
      }
    }
  }
}

