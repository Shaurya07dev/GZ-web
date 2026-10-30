"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
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

// Shared across all four logged-in shells — one bell, same place in every
// Topbar, next to SwitchMode. The feed is the user's own: the API scopes it
// to the signed-in account.
export function NotificationsPopover() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
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
      if (n.url) router.push(n.url);
    },
  });
  const items = data?.items ?? [];
  const groups: NotificationGroup[] = [
    { id: "new", label: "New", items: items.filter((n) => !n.read).map(toEvent) },
    { id: "earlier", label: "Earlier", items: items.filter((n) => n.read).map(toEvent) },
  ].filter((g) => g.items.length > 0);
  const unread = data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
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
  );
}
