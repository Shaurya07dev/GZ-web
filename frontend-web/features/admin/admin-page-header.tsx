import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Right-side slot: primary action button, range selector, export, etc. */
  action?: React.ReactNode;
  /** Detail pages pass the route of the list they were opened from. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

// Every admin page opens with one of these, so headings, spacing and the
// action-slot position stay identical across all 17 routes. Deliberately not a
// Client Component (same reasoning as components/shared/empty-state.tsx): it
// holds no state, so it drops into a Server Component page as easily as a
// client one.
export function AdminPageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = "Back",
  className,
}: AdminPageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}
