"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  FAQ_AUDIENCES,
  FAQ_ITEMS,
  type FaqAudience,
  type FaqItem,
} from "./faq-data";

// The public /faq page passes `audiences` with just "general" + "buyers" —
// profit-sharing, commission, slab and payout answers live behind login on
// the artist's and aggregator's own Support pages, which pass the full set.
// Client (18 Oct 2026): a cold visitor should see only general FAQs.
export function FaqTabs({
  audiences = FAQ_AUDIENCES.map((a) => a.value),
}: {
  audiences?: readonly FaqAudience[];
} = {}) {
  const visibleAudiences = useMemo(
    () => FAQ_AUDIENCES.filter((a) => audiences.includes(a.value)),
    [audiences],
  );
  const grouped = useMemo(() => {
    const map = new Map<FaqAudience, FaqItem[]>();
    for (const audience of visibleAudiences) map.set(audience.value, []);
    for (const item of FAQ_ITEMS) {
      if (visibleAudiences.some((a) => a.value === item.audience)) {
        map.get(item.audience)?.push(item);
      }
    }
    return map;
  }, [visibleAudiences]);

  const defaultValue = visibleAudiences[0]?.value ?? "general";

  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        {visibleAudiences.map((audience) => (
          <TabsTrigger
            key={audience.value}
            value={audience.value}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors data-active:border-gold/50 data-active:bg-gold/10 data-active:text-gold-bright after:hidden"
          >
            {audience.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {visibleAudiences.map((audience) => {
        const items = grouped.get(audience.value) ?? [];
        return (
          <TabsContent
            key={audience.value}
            value={audience.value}
            className="mt-8"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card px-6 sm:px-8"
            >
              <Accordion multiple>
                {items.map((item, index) => (
                  <AccordionItem
                    key={item.question}
                    value={`${audience.value}-${index}`}
                  >
                    <AccordionTrigger className="py-5 text-base font-medium text-foreground hover:text-gold-bright hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                      <p>{item.answer}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </motion.div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
