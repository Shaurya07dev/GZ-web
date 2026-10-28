"use client";

import { useMemo } from "react";
import { GuideLauncher } from "@/components/shared/guide-launcher";
import { GUIDES_FOR } from "@/lib/guides";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { FAQ_ITEMS, type FaqAudience } from "./faq-data";

// FAQs live inside Support rather than in their own portal tab — one place a
// signed-in user goes when they need an answer. The content is the same
// dataset the public /faq page renders (features/faq/faq-data.ts), filtered
// to the portal's own audience plus the general questions, so answers can
// never drift between the two surfaces.
export function SupportFaqPanel({ audience }: { audience: FaqAudience }) {
  const items = useMemo(
    () =>
      FAQ_ITEMS.filter(
        (item) => item.audience === audience || item.audience === "general",
      ),
    [audience],
  );
  const guides =
    audience === "artists" || audience === "aggregators"
      ? GUIDES_FOR[audience]
      : [];

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-base font-semibold text-foreground">
        FAQs
      </h2>

      <div className="rounded-lg border border-border bg-card px-4 sm:px-5">
        <Accordion multiple>
          {items.map((item, index) => (
            // Keyed by index, not item.question: general and artists FAQs
            // can legitimately share a question ("What is GalleryZone?")
            // with different answers, and this panel merges both audiences
            // into one list — the value prop already had a unique string.
            <AccordionItem key={`faq-${index}`} value={`faq-${index}`}>
              <AccordionTrigger className="py-4 text-sm font-medium text-foreground hover:text-gold-bright hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">
                <p>{item.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Everything beyond the one explainer under the aggregator terms
          lives here, for this portal's own audience. */}
      {guides.length > 0 && (
        <>
          <h2 className="mt-3 font-display text-base font-semibold text-foreground">
            Video walkthroughs
          </h2>
          <div className="flex flex-col gap-2">
            {guides.map((guide) => (
              <GuideLauncher key={guide.src} guide={guide} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
