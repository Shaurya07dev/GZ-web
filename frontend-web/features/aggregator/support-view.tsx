"use client";

import { useState, type FormEvent } from "react";
import { Mail, Phone, Percent, Clock3, PackageCheck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useAggregatorSupport,
  useSubmitAggregatorTicketMutation,
} from "@/hooks/useAggregatorSupport";

const FAQ = [
  {
    icon: Percent,
    question: "How is my commission calculated?",
    answer:
      "20% of the difference between your display price and the GalleryZone customer price (Profit Share = 20% × (Listed Price − Artist Price)). Paid only after full customer payment, delivery, and any return window closes.",
  },
  {
    icon: Clock3,
    question: "How long can I hold a reserved artwork?",
    answer:
      "30 days from the reservation date, unless otherwise approved by GalleryZone. Unsold pieces may be relocated to another aggregator or sales channel after that.",
  },
  {
    icon: PackageCheck,
    question: "What's the advance payment for reserving an artwork?",
    answer:
      "5% or 3% of the artwork's value plus applicable delivery charges, paid before you take possession for display. This is adjusted upon successful sale.",
  },
];

// Ticket submission isn't wired to a live support inbox in this demo — same
// honest-mock pattern as the Artist Dashboard's equivalent. Real issues go
// to the contact details below.
export function AggregatorSupportView() {
  const { data: tickets } = useAggregatorSupport();
  const submitMutation = useSubmitAggregatorTicketMutation();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitMutation.mutate(
      { subject, message },
      {
        onSuccess: () => {
          setSubject("");
          setMessage("");
        },
      },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-gold/30 bg-gold/5 p-5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Contact GalleryZone
          </h2>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <a
              href="mailto:galleryzone@zohomail.in"
              className="flex items-center gap-2 text-gold-bright hover:underline"
            >
              <Mail className="size-4" />
              galleryzone@zohomail.in
            </a>
            <a
              href="tel:+919492953627"
              className="flex items-center gap-2 text-gold-bright hover:underline"
            >
              <Phone className="size-4" />
              +91 94929 53627
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="font-display text-base font-semibold text-foreground">
            Frequently asked
          </h2>
          {FAQ.map((item) => (
            <div
              key={item.question}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <item.icon
                  className="size-4 shrink-0 text-gold-bright"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-medium text-foreground">
                  {item.question}
                </p>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Raise a ticket
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This demo doesn&rsquo;t send to a live inbox — for real issues,
              email us directly above.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticketSubject">Subject</Label>
            <Input
              id="ticketSubject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Question about my advance payment"
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticketMessage">Message</Label>
            <Textarea
              id="ticketMessage"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue..."
              rows={4}
            />
          </div>

          <button
            type="submit"
            disabled={
              !subject.trim() || !message.trim() || submitMutation.isPending
            }
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
          >
            Submit ticket
          </button>

          {submitMutation.isSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-gold-bright">
              <Check className="size-3.5" />
              Ticket submitted.
            </p>
          )}
        </form>

        {tickets && tickets.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-base font-semibold text-foreground">
              Your tickets
            </h2>
            <div className="mt-3 flex flex-col divide-y divide-border">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">
                      {ticket.subject}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground capitalize">
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {ticket.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
