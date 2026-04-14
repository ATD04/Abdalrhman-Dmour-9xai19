"use client";

import { useChatContext } from "./ChatContext";
import { ChatMessage } from "./ChatMessage";
import { ChatLoadingPipeline } from "./ChatLoadingPipeline";
import { AnimatePresence } from "framer-motion";

export function ChatMessageList() {
  const { messages, loading, bottomRef } = useChatContext();

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 28 }}>
      <AnimatePresence initial={false}>
        {messages.map((msg, index) => (
          <ChatMessage key={msg.id} msg={msg} index={index} />
        ))}
      </AnimatePresence>
      {loading && <ChatLoadingPipeline />}
      <div ref={bottomRef} />
    </div>
  );
}
