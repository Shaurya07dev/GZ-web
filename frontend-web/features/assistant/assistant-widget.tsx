"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { readSessionRole, subscribeToSession } from "@/lib/session";
import { getStarterQuestions } from "./fuzzy-match";
import { useAssistant } from "./use-assistant";

// Floating help assistant. Mounted once in the root layout; hides itself
// until the user is signed in. Hardcoded Q&A matched with Fuse — no API
// calls, no LLM, no cost. The user types a question, we fuzzy-match
// against features/assistant/faq-knowledge-base.ts and return the best
// answer, or a graceful "contact support" fallback.
//
// Not shown on auth pages (login/register/reset) or on the public site
// routes where it would clash with marketing copy.
const HIDDEN_PATH_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

const BUTTON_SIZE = "size-12 sm:size-14";

export function AssistantWidget() {
  const sessionRole = useSyncExternalStore(
    subscribeToSession,
    readSessionRole,
    () => null,
  );
  const [currentPath, setCurrentPath] = useState<string>("");

  // Track the pathname via the browser's own History API. Using next/navigation's
  // usePathname would require being inside a Suspense boundary + App Router
  // client context, and we want this to work from the root layout without
  // additional provider wiring.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCurrentPath(window.location.pathname);
    const handler = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    // next/link clicks trigger pushState without firing popstate. Patch
    // pushState to emit a synthetic event we listen for, so our visibility
    // check stays in sync on client-side navigation.
    const originalPushState = window.history.pushState;
    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args as Parameters<typeof originalPushState>);
      window.dispatchEvent(new Event("gz:assistant-pathchange"));
      return result;
    };
    const pathHandler = () => setCurrentPath(window.location.pathname);
    window.addEventListener("gz:assistant-pathchange", pathHandler);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("gz:assistant-pathchange", pathHandler);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (!sessionRole) return null;
  if (HIDDEN_PATH_PREFIXES.some((p) => currentPath.startsWith(p))) return null;

  return <AssistantUi />;
}

function AssistantUi() {
  const { open, setOpen, messages, ask, clear } = useAssistant();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const starters = getStarterQuestions(4);

  // Keep the latest message in view when a new one arrives.
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    ask(trimmed);
    setInput("");
  }

  function handleStarter(question: string) {
    ask(question);
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        aria-label={open ? "Close help assistant" : "Open help assistant"}
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed right-5 bottom-5 z-[9000] flex items-center justify-center rounded-full border border-gold/40 bg-background text-gold-bright shadow-lg transition-transform hover:scale-105 active:scale-95",
          BUTTON_SIZE,
          // Push above the mobile bottom nav so the launcher doesn't sit under it.
          "mb-16 lg:mb-0",
        )}
      >
        {open ? (
          <X className="size-5" strokeWidth={2} />
        ) : (
          <MessageCircleQuestion className="size-6" strokeWidth={1.75} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          className={cn(
            "fixed right-5 bottom-5 z-[8999] flex flex-col overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl",
            // Positioned above the launcher button on all breakpoints
            "mb-16 lg:mb-0",
            "h-[70dvh] max-h-[560px] w-[calc(100vw-2.5rem)] max-w-sm",
            // Sit the top-right corner above the launcher so they align
            "mt-14 sm:mt-16",
          )}
          style={{ marginBottom: "4.5rem" }}
        >
          <header className="flex items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <p className="truncate font-display text-sm font-semibold text-foreground">
                GalleryZone help
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Instant answers from our FAQ
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} kind={m.kind} content={m.content} />
              ))}

              {/* Starter suggestions only shown on the greeting (no user turns yet). */}
              {messages.length === 1 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Try asking
                  </p>
                  {starters.map((s) => (
                    <button
                      key={s.question}
                      type="button"
                      onClick={() => handleStarter(s.question)}
                      className="rounded-md border border-border bg-background/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-gold/40 hover:bg-background"
                    >
                      {s.question}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-border bg-background/70 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about GalleryZone…"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-gold/50 focus:outline-none"
                autoComplete="off"
              />
              <button
                type="submit"
                aria-label="Send"
                disabled={!input.trim()}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-bright text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <Send className="size-4" strokeWidth={2} />
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  );
}

function MessageBubble({ role, content, kind }: { role: "user" | "assistant"; content: string; kind?: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-line",
          isUser
            ? "bg-gold-bright text-background"
            : "bg-background/60 text-foreground",
          kind === "fallback" && "border border-amber-500/40",
        )}
      >
        {content}
      </div>
    </div>
  );
}
