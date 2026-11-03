"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Barcode, Eye, FileText, Flower2, Palette, Printer, Ruler, ShieldCheck, ShoppingCart, User } from "lucide-react";
import { artworkQrDataUrl } from "@/lib/qr";

// The "FOR SALE" display card that travels with a piece (artist MOU §8.2 and §13.1d): artwork details on the
// left, a QR to the live passport on the right. Drawn from the Canva design as HTML so it stays sharp at any
// size and prints as vector. Every length is in container-width units (cqw), so the card scales as one piece:
// 100cqw is the card's width, and its height is 63cqw.

export interface DisplayCardInput {
  artworkId: string;
  title: string;
  description: string;
  /** Art form: the regional tradition when known, else the category. */
  artForm: string;
  medium: string;
  size: string;
  /** The artwork's code (GZ000045), not its database id. */
  artworkCode: string;
  artistName: string;
}

const GOLD = "#d9a21b";
const u = (n: number) => `${n}cqw`;
const abs = (s: CSSProperties): CSSProperties => ({ position: "absolute", ...s });

// --- Fitting text into the card's fixed slots ---------------------------------------------------------
// The card is a fixed size, so long values have to give way somewhere. Rule: shrink the type first, down to a
// floor that is still readable on a 148 mm card, and only then cut, always at a word boundary and with an
// ellipsis, never mid-word or silently by the browser. The numbers are characters per slot at each size
// (Inter averages ~0.56em per character).

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
/** "painting" -> "Painting", "mixed-media" -> "Mixed media". */
const labelize = (text: string) => {
  const t = collapse(text).replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max).replace(/\s+\S*$/, "").replace(/[\s,;:.\-–]+$/, "");
  return `${cut}…`;
}

/** Short values at full size; longer ones step down to 1.75cqw and may wrap to two lines, then are cut at a word. */
function lineFit(text: string): { size: number; text: string } {
  return { size: text.length <= 24 ? 2 : 1.75, text: cutAtWord(text, 56) };
}

/** Description type sizes, largest first. 1.55cqw is ~6.5pt on the printed 148 mm card, the floor for reading it. */
const DESC_SIZES = [2, 1.85, 1.7, 1.55];

/**
 * The description wraps over three lines, with its label run in on the first. It is measured, not estimated:
 * the paragraph takes the largest size in DESC_SIZES whose text fits the three lines, and only if even the
 * smallest does not fit is the text cut, at a word boundary, until it does. So a short description is large
 * and easy to read, a long one shrinks to fit, and nothing is clipped mid-word by the browser.
 */
function FitDescription({ text }: { text: string }) {
  const para = useRef<HTMLParagraphElement>(null);
  const body = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const p = para.current;
    const span = body.current;
    if (!p || !span) return;
    const full = collapse(text);
    const fit = () => {
      span.textContent = full;
      const fits = () => p.scrollHeight <= p.clientHeight + 1;
      let size = DESC_SIZES[DESC_SIZES.length - 1]!;
      for (const s of DESC_SIZES) {
        p.style.fontSize = u(s);
        if (fits()) {
          size = s;
          break;
        }
      }
      p.style.fontSize = u(size);
      let n = full.length;
      while (!fits() && n > 12) {
        n = Math.floor(n * 0.94);
        span.textContent = cutAtWord(full, n);
      }
    };
    fit();
    // Re-measure once the web fonts are in: widths change when Inter replaces the fallback.
    let live = true;
    void document.fonts?.ready.then(() => live && fit());
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <p ref={para} className="font-medium" style={{ lineHeight: 1.22, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>
      <span className="font-extrabold uppercase" style={{ ...labelStyle, marginRight: u(1) }}>Description:</span>
      <span ref={body} />
    </p>
  );
}

const ROW_H = 5.3;
const LABEL_W = 18.4;

function Row({ icon, children, height = ROW_H }: { icon: ReactNode; children: ReactNode; height?: number }) {
  return (
    <div
      className="grid items-center"
      style={{ height: u(height), gridTemplateColumns: `${u(4.2)} 1fr`, columnGap: u(1.8), borderBottom: `${u(0.22)} dotted ${GOLD}` }}
    >
      <span className="flex items-center justify-center rounded-full bg-black text-[#e8b923]" style={{ width: u(4.2), height: u(4.2) }}>
        {icon}
      </span>
      {children}
    </div>
  );
}

const labelStyle: CSSProperties = { fontSize: u(2.1), letterSpacing: "0.01em" };

/** A label and a one-line value, with the values lined up in one column. */
function FieldRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const fit = lineFit(collapse(value));
  return (
    <Row icon={icon}>
      <div className="flex min-w-0 items-center" style={{ gap: u(1) }}>
        <p className="shrink-0 whitespace-nowrap font-extrabold uppercase leading-none" style={{ ...labelStyle, width: u(LABEL_W) }}>
          {label}:
        </p>
        <p className="min-w-0 flex-1 font-medium" style={{ fontSize: u(fit.size), lineHeight: 1.15, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
          {fit.text}
        </p>
      </div>
    </Row>
  );
}

export function DisplayCard({ input, qr }: { input: DisplayCardInput; qr: string | null }) {
  const icon = { width: u(2.3), height: u(2.3) };
  const sep = { width: u(0.14), height: u(2.8), background: "#ffffff55" };
  const scanIcon = { width: u(2.1), height: u(2.1), color: GOLD };

  return (
    <div
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: "1000 / 630", containerType: "inline-size", color: "#000", fontFamily: "var(--font-body-raw), system-ui, sans-serif" }}
    >
      {/* White panel, black panel with its curved gold edge, and the gold frame. */}
      <svg viewBox="0 0 1000 630" className="absolute inset-0 size-full" aria-hidden="true">
        <path d="M 650 0 L 1000 0 L 1000 630 L 560 630 C 602 560, 640 520, 640 440 C 640 360, 606 330, 610 260 C 614 180, 632 90, 650 0 Z" fill="#050505" />
        <path d="M 650 0 C 632 90, 614 180, 610 260 C 606 330, 640 360, 640 440 C 640 520, 602 560, 560 630" fill="none" stroke={GOLD} strokeWidth="6" />
        <rect x="4" y="4" width="992" height="622" rx="6" fill="none" stroke={GOLD} strokeWidth="8" />
      </svg>

      {/* Brand */}
      <Image src="/brand/gz-logo.png" alt="GalleryZone" width={822} height={560} priority style={abs({ left: u(2.4), top: u(-0.9), width: u(17.4) })} />
      <div style={abs({ left: u(21.4), top: u(2.6), width: u(36) })}>
        <p className="font-display leading-none" style={{ fontSize: u(5.4), letterSpacing: "-0.01em" }}>Galleryzone</p>
        <div className="flex items-center" style={{ gap: u(0.8), margin: `${u(0.7)} 0 ${u(0.8)}` }}>
          <span className="flex-1" style={{ height: u(0.2), background: GOLD }} />
          <span style={{ width: u(0.9), height: u(0.9), background: GOLD, transform: "rotate(45deg)" }} />
          <span className="flex-1" style={{ height: u(0.2), background: GOLD }} />
        </div>
        <p className="font-display text-center italic leading-none" style={{ fontSize: u(2.05) }}>art that connects, culture that inspires</p>
      </div>

      <p className="font-black leading-none" style={abs({ left: u(3.2), top: u(12.6), fontSize: u(10.8), color: "#d70000", letterSpacing: "-0.02em" })}>
        FOR SALE
      </p>

      {/* The details. Fixed row heights, so the spacing is identical however long a value is. */}
      <div style={abs({ left: u(3), top: u(24.6), width: u(54) })}>
        <FieldRow icon={<User style={icon} />} label="Artwork title" value={input.title} />
        <Row icon={<FileText style={icon} />} height={7.9}>
          <FitDescription text={input.description} />
        </Row>
        <FieldRow icon={<Flower2 style={icon} />} label="Art form" value={input.artForm} />
        <FieldRow icon={<Palette style={icon} />} label="Medium" value={input.medium} />
        <FieldRow icon={<Ruler style={icon} />} label="Size" value={input.size} />
        <FieldRow icon={<Barcode style={icon} />} label="Artwork ID" value={input.artworkCode} />
      </div>
      <p className="whitespace-nowrap text-right" style={abs({ left: u(3), width: u(51.5), bottom: u(1.3), fontSize: u(2.2) })}>
        <span className="font-extrabold">{input.artistName}</span>: <span className="font-display italic">Artist</span>
      </p>

      {/* Scan panel */}
      <div className="flex items-center justify-center" style={abs({ left: u(67), top: u(8.4), width: u(30), gap: u(1) })}>
        <span className="flex-1" style={{ height: u(0.2), background: GOLD }} />
        <p className="font-bold uppercase" style={{ fontSize: u(2), color: GOLD, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Scan to explore</p>
        <span className="flex-1" style={{ height: u(0.2), background: GOLD }} />
      </div>
      <div className="rounded-[2cqw] p-[0.5cqw]" style={abs({ left: u(67.4), top: u(12.6), width: u(29.2), height: u(29.2), border: `${u(0.35)} solid ${GOLD}` })}>
        <div className="relative size-full rounded-[1.5cqw] bg-white" style={{ padding: u(1.4) }}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
            <img src={qr} alt="QR code to this artwork's passport" className="size-full" />
          ) : null}
          <span
            className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-black"
            style={{ width: u(8.4), height: u(8.4), border: `${u(0.3)} solid ${GOLD}` }}
          >
            <span className="font-display font-bold leading-none" style={{ fontSize: u(3), color: GOLD }}>GZ</span>
            <span className="font-display leading-none" style={{ fontSize: u(0.95), color: GOLD, marginTop: u(0.3) }}>GALLERYZONE</span>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center font-semibold text-white" style={abs({ left: u(66.8), top: u(47.8), width: u(30.4), gap: u(1.1), fontSize: u(1.22), letterSpacing: "0.02em" })}>
        <span className="flex shrink-0 items-center" style={{ gap: u(0.7) }}><Eye style={scanIcon} />DISCOVER</span>
        <span className="shrink-0" style={sep} />
        <span className="flex shrink-0 items-center" style={{ gap: u(0.7) }}><ShieldCheck style={scanIcon} />VERIFY</span>
        <span className="shrink-0" style={sep} />
        <span className="flex shrink-0 items-center" style={{ gap: u(0.7) }}><ShoppingCart style={scanIcon} />COLLECT</span>
      </div>
      <p className="font-display text-center italic" style={abs({ left: u(66.6), top: u(55.6), width: u(30.8), fontSize: u(2.35), color: GOLD, whiteSpace: "nowrap" })}>
        Original Art. Timeless Stories.
      </p>
    </div>
  );
}

/** The card on screen with a print button. Printing mounts a copy straight under <body> at the card's real size
 *  (148 x 93 mm), because the dialog's own transform would otherwise shift a fixed-position print layer. */
export function DisplayCardView({ input }: { input: DisplayCardInput }) {
  const [qr, setQr] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    let live = true;
    // H: the GZ seal sits over the middle of the code, and the code has to scan through it.
    artworkQrDataUrl(input.artworkId, 800, "H")
      .then((d) => live && setQr(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [input.artworkId]);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    // Two frames so the print copy has been laid out before the dialog opens.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="w-full overflow-hidden rounded-lg shadow-2xl shadow-black/50">
        <DisplayCard input={input} qr={qr} />
      </div>
      <button
        type="button"
        onClick={() => setPrinting(true)}
        disabled={!qr}
        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gold/60 px-4 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="size-3.5" />
        Print display card
      </button>
      {printing &&
        createPortal(
          <div className="gz-print-area">
            <DisplayCard input={input} qr={qr} />
          </div>,
          document.body,
        )}
    </div>
  );
}

export { labelize };
