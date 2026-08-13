import React from "react";
import { RiCloseFill } from "react-icons/ri";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { mockArtworks } from "@/lib/mock-data/artworks";

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
  className?: string;
}

function artworkAvatar(id: string): { avatar?: string; initials: string } {
  const artwork = mockArtworks.find((a) => a.id === id);
  const initials = (artwork?.title ?? "GZ")
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return { avatar: artwork?.thumbnailUrl, initials };
}

const defaultGroups: NotificationGroup[] = [
  {
    id: "today",
    label: "Today",
    items: [
      {
        id: "artwork-approved",
        source: {
          name: "Monsoon Over Madurai",
          ...artworkAvatar("monsoon-over-madurai"),
        },
        title: "Your artwork was approved",
        subtitle: "Monsoon Over Madurai is now live on the marketplace",
        timestamp: "12m ago",
        unread: true,
      },
      {
        id: "new-order",
        source: {
          name: "Ancestral Bronze Study",
          ...artworkAvatar("ancestral-bronze-study"),
        },
        title: "You have a new order",
        subtitle: "Ancestral Bronze Study: payment confirmed",
        timestamp: "24m ago",
        unread: true,
      },
      {
        id: "kyc-verified",
        source: { name: "GalleryZone", initials: "GZ" },
        title: "KYC verification complete",
        subtitle: "Tier 2 documents verified",
        timestamp: "38m ago",
        unread: true,
      },
    ],
  },
  {
    id: "earlier",
    label: "Earlier",
    items: [
      {
        id: "wishlist-add",
        source: {
          name: "Last Show at Metro Talkies",
          ...artworkAvatar("last-show-at-metro-talkies"),
        },
        title: "Added to a wishlist",
        subtitle: "Last Show at Metro Talkies was saved by a collector",
        timestamp: "3h ago",
        unread: true,
      },
      {
        id: "settlement-paid",
        source: { name: "GalleryZone", initials: "GZ" },
        title: "Settlement paid out",
        subtitle: "₹42,300 transferred to your wallet",
        timestamp: "5h ago",
        unread: false,
      },
    ],
  },
];

export default function Notification4({
  title = "Notifications",
  countLabel,
  groups = defaultGroups,
  onDismiss,
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
  return (
    <article className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/50 sm:gap-3">
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
        <h3 className="truncate text-sm font-medium text-foreground">
          {event.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {event.subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center">
        <span className="text-xs text-muted-foreground">{event.timestamp}</span>
      </div>
    </article>
  );
}
