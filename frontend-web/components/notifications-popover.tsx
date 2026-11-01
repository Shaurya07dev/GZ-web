"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Notification4, {
  type NotificationEvent,
  type NotificationGroup,
} from "@/components/ui/notification-04";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";
import type { AppNotification } from "@/services/notificationsService";

const relative = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto", style: "short" });
function ago(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutes > -60) return relative.format(minutes, "minute");
  if (minutes > -60 * 24) return relative.format(Math.round(minutes / 60), "hour");
  return relative.format(Math.round(minutes / (60 * 24)), "day");
}

const exact = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

// Shared across all four logged-in shells — one bell, same place in every
// Topbar, next to SwitchMode. The feed is the user's own: the API scopes it
// to the signed-in account.
//
// The list is a summary: a long message is cut to three lines. Selecting a
// notification opens all of it, with its exact time; the page it points to
// (if any) is one more tap, on "Open".
export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  // The notification being read. Kept after the dialog closes so its text
  // doesn't vanish halfway through the fade-out.
  const [reading, setReading] = useState<AppNotification | null>(null);
  const [readingOpen, setReadingOpen] = useState(false);
  const bell = useRef<HTMLButtonElement>(null);
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const toEvent = (n: AppNotification): NotificationEvent => ({
    id: n.id,
    source: { name: "GalleryZone", initials: "GZ" },
    title: n.title,
    subtitle: n.body,
    timestamp: ago(n.createdAt),
    unread: !n.read,
    onSelect: () => {
      if (!n.read) markRead.mutate(n.id);
      setOpen(false);
      setReading(n);
      setReadingOpen(true);
    },
  });
  const items = data?.items ?? [];
  const groups: NotificationGroup[] = [
    { id: "new", label: "New", items: items.filter((n) => !n.read).map(toEvent) },
    { id: "earlier", label: "Earlier", items: items.filter((n) => n.read).map(toEvent) },
  ].filter((g) => g.items.length > 0);
  const unread = data?.unreadCount ?? 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          ref={bell}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative rounded-md p-1.5 text-foreground/80 transition-colors hover:text-foreground"
        >
          <Bell className="size-5" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 size-2 rounded-full bg-gold-bright ring-2 ring-background" />
          )}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-auto rounded-3xl border-0 bg-transparent p-0 shadow-xl ring-0"
        >
          <Notification4
            groups={groups}
            countLabel={unread > 0 ? String(unread) : undefined}
            onDismiss={() => setOpen(false)}
            onMarkAllRead={unread > 0 ? () => markAllRead.mutate() : undefined}
          />
        </PopoverContent>
      </Popover>

      <Dialog open={readingOpen} onOpenChange={setReadingOpen}>
        {/* Closing returns to the bell, where the person was, rather than to a row that no longer exists. */}
        <DialogContent finalFocus={bell} className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
          {reading && (
            <>
              <DialogHeader>
                {/* pr-8 keeps a long title clear of the close button; the dialog's own leading-none would stack its lines. */}
                <DialogTitle className="pr-8 leading-snug">{reading.title}</DialogTitle>
                <DialogDescription>{exact.format(new Date(reading.createdAt))}</DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed break-words whitespace-pre-line text-foreground">{reading.body}</p>
              {reading.url && (
                <DialogFooter>
                  <Link href={reading.url} onClick={() => setReadingOpen(false)} className={buttonVariants()}>
                    Open
                  </Link>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
