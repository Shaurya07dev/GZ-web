import { ACTIVITY_FEED } from "./dashboard-data";

export function RecentActivityFeed() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Recent activity
      </h2>

      <ul className="mt-4 flex flex-col gap-4">
        {ACTIVITY_FEED.map((item) => (
          <li key={item.id} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
              <item.icon
                className="size-4 text-gold-bright"
                strokeWidth={1.5}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
              {item.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
