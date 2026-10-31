import React from "react";
import { RiCloseFill } from "react-icons/ri";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export interface NotificationSource {
  name: string;
  initials: string;
  avatar?: string;
}

export interface NotificationEvent {
  id: string;
  source: NotificationSource;
  title: string;
  subtitle: string;
  timestamp: string;
  unread?: boolean;
  /** Makes the row a button: open what it's about. */
  onSelect?: () => void;
}

export interface NotificationGroup {
  id: string;
  label: string;
  items: NotificationEvent[];
}

export interface Notification4Props {
  title?: string;
  countLabel?: string;
  groups?: NotificationGroup[];
  onDismiss?: () => void;
  onMarkAllRead?: () => void;
  className?: string;
}

const defaultGroups: NotificationGroup[] = [];

export default function Notification4({
  title = "Notifications",
  countLabel,
  groups = defaultGroups,
  onDismiss,
  onMarkAllRead,
  className,
}: Notification4Props) {
  const unreadCount = groups.reduce(
    (total, group) => total + group.items.filter((item) => item.unread).length,
    0,
  );

  return (
    <section
      className={cn(
        "flex items-center justify-center bg-background",
        className,
      )}
    >
      <Card className="w-full max-w-sm gap-0 rounded-3xl bg-muted pb-2 ring-0">
        <CardHeader className="flex flex-row items-center justify-between px-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {unreadCount > 0 && (
              <Badge
                variant="ghost"
                className="rounded-full text-xs font-medium text-primary tabular-nums hover:text-primary"
              >
                {countLabel ?? `${unreadCount}+`}
              </Badge>
            )}
          </div>

          {onMarkAllRead && (
            <Button variant="ghost" size="sm" className="ml-auto rounded-full text-xs text-muted-foreground" onClick={onMarkAllRead}>
              Mark all read
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-muted-foreground"
            aria-label="Close notifications"
            onClick={onDismiss}
          >
            <RiCloseFill className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-2 px-2">
          {groups.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You&rsquo;re all caught up — nothing new right now.
            </p>
          )}
          {groups.map((group) => (
            <NotificationGroupCard key={group.id} group={group} />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}

function NotificationGroupCard({ group }: { group: NotificationGroup }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-card">
      <div className="px-5 pt-4">
        <p className="text-sm font-medium text-muted-foreground">
          {group.label}
        </p>
      </div>

      <div className="px-4 pt-2 pb-2">
        {group.items.map((event) => (
          <React.Fragment key={event.id}>
            <NotificationEventRow event={event} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function NotificationEventRow({ event }: { event: NotificationEvent }) {
  const Row = event.onSelect ? "button" : "article";
  return (
    <Row
      {...(event.onSelect ? { type: "button" as const, onClick: event.onSelect } : {})}
      className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:outline-none sm:gap-3"
    >
      <Avatar className="h-10 w-10 shrink-0 border-none ring-0">
        <AvatarImage
          src={event.source.avatar}
          alt={event.source.name}
          className="border-black/5 dark:border-white/5"
        />
        <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
          {event.source.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        {/* Owner-reported 31 Oct 2026: notifications were truncated to one
            line even in the popover, which meant long bodies were unreadable
            at a glance. Title keeps a single-line truncate for density;
            subtitle wraps up to 3 lines, and both carry the full text as a
            native tooltip for anyone who still wants the whole string. */}
        <h3
          className="truncate text-sm font-medium text-foreground"
          title={event.title}
        >
          {event.title}
        </h3>
        <p
          className="mt-0.5 line-clamp-3 text-xs leading-snug text-muted-foreground"
          title={event.subtitle}
        >
          {event.subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <span className="text-xs text-muted-foreground">{event.timestamp}</span>
      </div>
    </Row>
  );
}
