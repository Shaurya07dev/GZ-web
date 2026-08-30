"use client";

import { useState } from "react";
import { MessageCircleQuestion, Sparkles } from "lucide-react";
import { INSURANCE_PARTNER } from "./artwork-submit-data";

// Not a real chatbot — there's no backend to answer a free-form question, so
// this is a fixed set of Q&A rendered as a chat transcript. Picking a preset
// question appends both bubbles at once; there's no typing or free text.
const INSURANCE_FAQS: { question: string; answer: string }[] = [
  {
    question: "What does the insurance actually cover?",
    answer:
      "Theft, fire, transit damage and loss while the piece is out of your hands — in transit or on display with an aggregator. It does not cover normal wear and tear.",
  },
  {
    question: "What happens if I decline it?",
    answer: `You can still list your work, but GalleryZone, its aggregators and logistics partners carry no liability for the piece in transit. Declining is only allowed for marketplace-only listings — aggregator display requires cover.`,
  },
  {
    question: "Who pays for the policy?",
    answer:
      "You buy it directly through the insurer. The premium isn't collected by GalleryZone — it's a separate charge from them, not deducted from your settlement.",
  },
  {
    question: "Where do I get my policy/certificate number?",
    answer: `After you complete the application on the ${INSURANCE_PARTNER} site, they issue a policy or certificate number by email. Paste that into the field above once you have it.`,
  },
  {
    question: "How long until GalleryZone verifies it?",
    answer:
      'Admin review usually clears within a couple of business days. You\'ll see the status change here from "Pending review" to "Verified".',
  },
];

export function InsuranceFaqChat() {
  const [asked, setAsked] = useState<string[]>([]);

  const remaining = INSURANCE_FAQS.filter(
    (faq) => !asked.includes(faq.question),
  );

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background/60 p-3.5">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion
          className="size-4 text-gold-bright"
          strokeWidth={1.75}
        />
        <p className="text-xs font-medium text-foreground">
          Insurance — common questions
        </p>
      </div>

      {asked.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {asked.map((question) => {
            const faq = INSURANCE_FAQS.find((f) => f.question === question);
            if (!faq) return null;
            return (
              <div key={question} className="flex flex-col gap-1.5">
                <p className="ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-gold/15 px-3 py-1.5 text-xs text-foreground">
                  {faq.question}
                </p>
                <p className="flex max-w-[85%] items-start gap-1.5 rounded-lg rounded-bl-sm border border-border bg-card px-3 py-1.5 text-xs leading-relaxed text-muted-foreground">
                  <Sparkles className="mt-0.5 size-3 shrink-0 text-gold-bright" />
                  {faq.answer}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {remaining.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {remaining.map((faq) => (
            <button
              key={faq.question}
              type="button"
              onClick={() => setAsked((prev) => [...prev, faq.question])}
              className="rounded-full border border-gold/30 px-2.5 py-1 text-[11px] font-medium text-gold-bright transition-colors hover:bg-gold/10"
            >
              {faq.question}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          That&rsquo;s everything we&rsquo;ve got preset — for anything else,
          reach Support.
        </p>
      )}
    </div>
  );
}
