"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Subtle radial dot pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute size-[460px] rounded-full bg-gold/10 blur-[130px]"
        aria-hidden
      />

      <div className="relative z-10 flex max-w-lg flex-col items-center">
        {/* Brand link with official logo */}
        <Link
          href="/"
          className="mb-10 flex items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <Image
            src="/brand/gz-logo.png"
            alt="GalleryZone"
            width={822}
            height={560}
            priority
            className="h-9 w-auto"
          />
          <span className="text-sm font-medium tracking-[0.18em] text-foreground">
            GALLERYZONE
          </span>
        </Link>

        {/* 404 number display */}
        <p className="bg-gradient-to-r from-gold-deep via-gold to-gold-bright bg-clip-text font-display text-8xl leading-none font-bold text-transparent sm:text-9xl">
          404
        </p>

        <h1 className="mt-6 text-balance font-display text-3xl font-semibold sm:text-4xl">
          Page not found.
        </h1>

        <p className="mt-4 text-balance text-base leading-relaxed text-muted-foreground">
          This page doesn&rsquo;t exist, or it&rsquo;s been moved. Let&rsquo;s
          get you back to the art.
        </p>

        {/* Action buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-md border border-gold/60 bg-gold/10 px-6 py-3 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/20"
          >
            Back to home
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 rounded-md border border-border bg-card px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
