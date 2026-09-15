"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Notification4, {
  type NotificationGroup,
} from "@/components/ui/notification-04";

// Shared across all four logged-in shells (Admin, Artist Dashboard,
// Aggregator, Account) — one bell, same place in every Topbar, right next to
// SwitchMode. `groups` is optional: omit it for the empty state; pass a
// role-specific list to show that role's own items.
export function NotificationsPopover({
  groups,
}: {
  groups?: NotificationGroup[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label="Notifications"
        className="relative rounded-md p-1.5 text-foreground/80 transition-colors hover:text-foreground"
      >
        <Bell className="size-5" strokeWidth={1.75} />
        {(groups?.length ?? 0) > 0 && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-gold-bright ring-2 ring-background" />
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-auto rounded-3xl border-0 bg-transparent p-0 shadow-xl ring-0"
      >
        <Notification4 groups={groups} onDismiss={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
