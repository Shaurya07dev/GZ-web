"use client";

import { useCallback, useState } from "react";
import { findBestFaqMatch } from "./fuzzy-match";

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  /** Set on the greeting + fallback messages so the UI can style them differently if we want. */
  kind?: "greeting" | "answer" | "fallback";
}

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  kind: "greeting",
  content:
    "Hi! I'm the GalleryZone help assistant. Ask me anything about how the platform works — buying, selling, COA/NFC, payments, aggregators. Pick a question below or type your own.",
};

const FALLBACK = (query: string): ChatMessage => ({
  id: `fallback-${Date.now()}`,
  role: "assistant",
  kind: "fallback",
  content:
    `I don't have an answer for "${query}" yet. For help, open a Support ticket from your sidebar or email support@galleryzone.art — a human will get back within a day.`,
});

export function useAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);

  const ask = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    const match = findBestFaqMatch(trimmed);
    const answer: ChatMessage = match
      ? {
          id: `a-${Date.now()}`,
          role: "assistant",
          kind: "answer",
          content: match.entry.answer,
        }
      : FALLBACK(trimmed);
    setMessages((prev) => [...prev, userMessage, answer]);
  }, []);

  const clear = useCallback(() => setMessages([GREETING]), []);

  return {
    open,
    setOpen,
    messages,
    ask,
    clear,
  };
}
