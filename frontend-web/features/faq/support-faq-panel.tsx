"use client";

import { useMemo } from "react";
import { PlayCircle } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-base font-semibold text-foreground">
        FAQs
      </h2>

      <div className="rounded-lg border border-border bg-card px-4 sm:px-5">
        <Accordion multiple>
          {items.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`}>
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

      {/* Placeholder for the walkthrough videos. Everything beyond the single
          aggregator-terms explainer is hosted on YouTube and linked from
          here — drop the links in when the channel is ready. */}
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border p-4">
        <PlayCircle
          className="mt-0.5 size-5 shrink-0 text-gold-bright"
          strokeWidth={1.5}
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            Video walkthroughs
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Short videos explaining listing, aggregator display, and
            settlement will be linked here. Coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
