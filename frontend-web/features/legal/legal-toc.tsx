import type { LegalSection } from "./types";

interface LegalTocProps {
  sections: LegalSection[];
}

// Desktop-only sticky sidebar of anchor links. Hidden below `lg` (the
// article itself is the primary reading surface on mobile — a jump-list
// competing for space there does more harm than good).
export function LegalToc({ sections }: LegalTocProps) {
  return (
    <nav
      aria-label="Table of contents"
      className="sticky top-28 hidden h-fit w-56 shrink-0 flex-col gap-1 lg:flex"
    >
      <span className="mb-2 text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
        On this page
      </span>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {section.heading}
        </a>
      ))}
    </nav>
  );
}
