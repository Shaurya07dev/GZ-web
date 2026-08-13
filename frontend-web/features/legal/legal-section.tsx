import type { ReactNode } from "react";
import type { LegalSection } from "./types";

interface LegalSectionBlockProps {
  section: LegalSection;
  children?: ReactNode;
}

// `scroll-mt-24` clears the sticky h-20 SiteHeader when a TOC anchor link
// (or a direct #hash visit) jumps to this heading. `children` lets Cookies'
// "Cookie Categories" section slot in a real <table> after its intro
// paragraphs — every other section just renders its `body` paragraphs.
export function LegalSectionBlock({ section, children }: LegalSectionBlockProps) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
        {section.heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {section.body.map((paragraph, index) => (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
            {paragraph}
          </p>
        ))}
      </div>
      {children}
    </section>
  );
}
