import Image from "next/image";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/hooks/useCurrentUser";

/**
 * Avatar for the signed-in account. Renders the uploaded profile photo when
 * one is present, otherwise initials from the account name. The photo URL
 * is the API's own served path with immutable caching, so Next's optimiser
 * handles the responsive variants.
 */
export function UserAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string | null | undefined;
  photoUrl?: string | null;
  className?: string;
}) {
  if (photoUrl) {
    return (
      <span
        aria-hidden
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full border border-gold/40",
          className,
        )}
      >
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes="80px"
          className="object-cover"
        />
      </span>
    );
  }
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
