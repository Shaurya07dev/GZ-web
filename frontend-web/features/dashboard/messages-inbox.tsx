"use client";

import { useState } from "react";
import { ChevronDown, Mail, MailOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { DoodleBackdrop } from "@/components/shared/doodle-backdrop";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useArtistMessages,
  useMarkMessageReadMutation,
} from "@/hooks/useArtistMessages";
import { cn } from "@/lib/utils";
import type { MessageThread } from "@/types/message";

// Single-column expandable list rather than a 2-pane inbox — this codebase's
// mock messages are flat single-message threads, not real conversations, so
// a click-to-expand row is the honest amount of UI for what the data is.
export function MessagesInbox() {
  const { data: messages, isPending } = useArtistMessages();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const markRead = useMarkMessageReadMutation();

  function toggle(message: MessageThread) {
    const opening = expandedId !== message.id;
    setExpandedId(opening ? message.id : null);
    if (opening && message.unread) markRead.mutate(message.id);
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No messages"
        description="Updates from GalleryZone about your submissions, sales, and account will show up here."
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card">
      <DoodleBackdrop />
      <div className="relative flex flex-col divide-y divide-border">
        {messages.map((message) => {
          const expanded = expandedId === message.id;
          return (
            <div key={message.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggle(message)}
                className="flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {message.unread ? (
                    <Mail className="size-4 text-gold-bright" strokeWidth={2} />
                  ) : (
                    <MailOpen className="size-4" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className={cn(
                        "truncate text-sm",
                        message.unread
                          ? "font-semibold text-foreground"
                          : "font-medium text-foreground",
                      )}
                    >
                      {message.subject}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(message.receivedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {message.from} &middot; {message.preview}
                  </p>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              {expanded && (
                <div className="px-4 pb-4 pl-11 text-sm leading-relaxed text-muted-foreground">
                  {message.body}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
