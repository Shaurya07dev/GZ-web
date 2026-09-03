import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ArtworkCardSkeletonProps {
  className?: string;
}

// Mirrors ArtworkCard's exact footprint (aspect-[4/5] image block, ~3 lines
// of text below) so a grid doesn't jump when skeletons swap for real cards.
export function ArtworkCardSkeleton({ className }: ArtworkCardSkeletonProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-1.5 h-5 w-1/3 border-t border-border pt-2.5" />
      </div>
    </div>
  );
}
