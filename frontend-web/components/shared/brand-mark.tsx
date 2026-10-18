import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  /** Height class comes from `className` (e.g. "h-9 w-auto"); width stays auto. */
  className?: string;
  /** Set when the mark sits in the above-the-fold hero or auth panel. */
  priority?: boolean;
  /** For surfaces that are intentionally dark in both themes (e.g. the
   *  marketplace passport card) — forces the white-on-transparent version
   *  regardless of the active theme. */
  forceDark?: boolean;
  /** Alt text; defaults to the brand name but can be empty when the mark is
   *  decorative next to a visible wordmark. */
  alt?: string;
}

// Two PNGs — black-on-transparent (`gz-logo.png`) for light surfaces, and
// white-on-transparent (`gz-logo-dark.png`) for dark ones. Both are shipped
// as siblings and toggled with Tailwind's `.dark` selector so SSR renders
// stable HTML and there is no hydration flash either way.
export function BrandMark({
  className,
  priority,
  forceDark = false,
  alt = "GalleryZone",
}: BrandMarkProps) {
  if (forceDark) {
    return (
      <Image
        src="/brand/gz-logo-dark.png"
        alt={alt}
        width={565}
        height={441}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <>
      <Image
        src="/brand/gz-logo.png"
        alt={alt}
        width={822}
        height={560}
        priority={priority}
        className={cn(className, "dark:hidden")}
      />
      <Image
        src="/brand/gz-logo-dark.png"
        alt=""
        aria-hidden
        width={565}
        height={441}
        priority={priority}
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}
