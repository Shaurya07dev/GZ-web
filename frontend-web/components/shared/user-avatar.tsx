import { cn } from "@/lib/utils";
import { initialsOf } from "@/hooks/useCurrentUser";

// Initials avatar for the signed-in account. Accounts don't carry a photo
// yet; when profile images land, this is the one place to swap in <Image>.
export function UserAvatar({ name, className }: { name: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 font-display text-xs font-semibold text-gold-bright",
        className,
      )}
    >
      {initialsOf(name) || "·"}
    </span>
  );
}
