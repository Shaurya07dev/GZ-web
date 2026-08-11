"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col lg:flex-row">
      <div className="relative flex min-h-[40vh] w-full items-center justify-center overflow-hidden bg-card p-10 lg:min-h-[100dvh] lg:w-1/2 lg:border-r lg:border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute size-[520px] rounded-full bg-gold/15 blur-[120px]"
          aria-hidden
        />
        <Image
          src="/brand/gz-logo-mark.png"
          alt="The GalleryZone GZ monogram"
          width={755}
          height={507}
          priority
          className="relative w-full max-w-sm drop-shadow-[0_30px_60px_rgba(0,0,0,0.4)]"
        />
      </div>

      <div className="relative flex w-full flex-col justify-center px-8 py-16 lg:w-1/2 lg:p-20 xl:p-28">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--gold) 0, var(--gold) 1px, transparent 1px, transparent 20px), repeating-linear-gradient(-45deg, var(--gold) 0, var(--gold) 1px, transparent 1px, transparent 20px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />

        <Link href="/" className="relative z-10 mb-12 flex w-fit items-baseline gap-2.5">
          <span className="font-display text-2xl font-semibold text-gold-bright italic">
            GZ
          </span>
          <span className="text-sm font-medium tracking-[0.18em] text-foreground">
            GALLERYZONE
          </span>
        </Link>

        <p className="relative z-10 bg-gradient-to-r from-gold-deep via-gold to-gold-bright bg-clip-text font-display text-7xl leading-none font-bold text-transparent sm:text-8xl">
          404
        </p>
        <h1 className="relative z-10 mt-5 text-balance font-display text-3xl font-semibold sm:text-4xl">
          Page not found.
        </h1>
        <p className="relative z-10 mt-4 max-w-sm text-balance text-base leading-relaxed text-muted-foreground">
          This page doesn&rsquo;t exist, or it&rsquo;s been moved. Let&rsquo;s
          get you back to the art.
        </p>

        <div className="relative z-10 mt-10 flex flex-wrap items-center gap-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-md border border-gold/60 px-6 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10"
          >
            Back to home
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
