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
import { FAQ_AUDIENCES, FAQ_ITEMS, type FaqAudience, type FaqItem } from "./faq-data";

export function FaqTabs() {
  const grouped = useMemo(() => {
    const map = new Map<FaqAudience, FaqItem[]>();
    for (const audience of FAQ_AUDIENCES) map.set(audience.value, []);
    for (const item of FAQ_ITEMS) map.get(item.audience)?.push(item);
    return map;
  }, []);

  return (
    <Tabs defaultValue="general">
      <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        {FAQ_AUDIENCES.map((audience) => (
          <TabsTrigger
            key={audience.value}
            value={audience.value}
            className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground transition-colors data-active:border-gold/50 data-active:bg-gold/10 data-active:text-gold-bright after:hidden"
          >
            {audience.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {FAQ_AUDIENCES.map((audience) => {
        const items = grouped.get(audience.value) ?? [];
        return (
          <TabsContent key={audience.value} value={audience.value} className="mt-8">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card px-6 sm:px-8"
            >
              <Accordion multiple>
                {items.map((item, index) => (
                  <AccordionItem key={item.question} value={`${audience.value}-${index}`}>
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
