import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { JourneyStep } from "./journey-data";

export function JourneyStepDetail({ step }: { step: JourneyStep }) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-[1.35fr_0.85fr_1fr]">
      <div className="relative min-h-[420px] overflow-hidden p-6 sm:p-8">
        <Image
          src="/journey/studio.png"
          alt="Artist's studio with an easel and painting in progress"
          fill
          sizes="600px"
          className="object-cover object-right"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/10" />

        <div className="relative z-10 flex h-full flex-col">
          <span className="w-fit rounded-md border border-gold/50 px-3 py-1 text-xs font-medium tracking-wide text-gold-bright">
            {step.badge}
          </span>
          <h3 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {step.label.toUpperCase()}
          </h3>
          <span className="mt-3 h-px w-6 bg-gold" />
          <p className="mt-5 max-w-[220px] text-sm leading-relaxed text-foreground/85">
            {step.detailDescription}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {step.requirements.map((req) => (
              <div key={req.label} className="flex w-[92px] flex-col gap-2.5">
                <span className="flex size-11 items-center justify-center rounded-md border border-gold/40">
                  <req.icon
                    className="size-4 text-gold-bright"
                    strokeWidth={1.75}
                  />
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">
                  {req.label}
                </span>
              </div>
            ))}
          </div>

          <Link
            href={step.ctaHref}
            className="group mt-8 inline-flex w-fit items-center gap-2 rounded-md border border-gold/60 px-5 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            {step.ctaLabel}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border p-6 lg:border-t-0 lg:border-l">
        <p className="text-sm font-medium text-foreground">
          {step.previewLabel}
        </p>
        <div className="relative aspect-square overflow-hidden rounded-md">
          <Image
            src="/journey/artwork-preview.png"
            alt="Eclipse of Thoughts by Aarav Mehta, moving through the GalleryZone journey"
            fill
            sizes="260px"
            className="object-cover"
          />
        </div>
        <div className="flex items-center gap-2.5 rounded-md border border-gold/50 bg-background/85 px-3 py-2.5">
          <step.previewBadge.icon className="size-4 shrink-0 text-gold-bright" />
          <span className="text-xs font-medium text-foreground">
            {step.previewBadge.label}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5 border-t border-border p-6 lg:border-t-0 lg:border-l">
        <p className="text-sm font-medium text-foreground">
          {step.detailsLabel}
        </p>

        <dl className="flex flex-col">
          {step.detailsRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-b-0"
            >
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-2.5 text-sm">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <span className="flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold-bright">
                {step.statusLabel}
                <span className="size-1.5 rounded-full bg-gold" />
              </span>
            </dd>
          </div>
        </dl>

        <div className="rounded-md border border-border p-4">
          <p className="text-xs font-medium text-foreground">
            What happens next?
          </p>
          <div className="mt-4 flex items-center overflow-x-auto">
            {step.nextSteps.map((next, i) => (
              <div key={next.label} className="flex items-center">
                <div className="flex w-16 flex-col items-center gap-1.5 text-center">
                  <span className="flex size-8 items-center justify-center rounded-md border border-gold/40">
                    <next.icon
                      className="size-3.5 text-gold-bright"
                      strokeWidth={1.75}
                    />
                  </span>
                  <span className="text-[10px] font-medium text-foreground">
                    {next.label}
                  </span>
                  <span className="text-[9px] leading-tight text-muted-foreground">
                    {next.sub}
                  </span>
                </div>
                {i < step.nextSteps.length - 1 && (
                  <ArrowRight className="mx-1 size-3 shrink-0 text-muted-foreground/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
