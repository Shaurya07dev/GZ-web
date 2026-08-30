import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

// The wordmark shown above every portal's side navbar (dashboard, aggregator,
// admin, account) — one shared component so the four shells can never drift
// on which logo file, size, or link they point at.
export function SidebarBrand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <Image
        src="/brand/gz-logo.png"
        alt="GalleryZone"
        width={822}
        height={560}
        priority
        className="h-8 w-auto shrink-0"
      />
      <span
        className={cn(
          "text-xs font-medium tracking-[0.18em] text-sidebar-foreground",
          collapsed && "lg:hidden",
        )}
      >
        GALLERYZONE
      </span>
    </Link>
  );
}
