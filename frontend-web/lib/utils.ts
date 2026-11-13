import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Single shared money formatter — every ₹ amount in the app renders through
// this (never an ad-hoc toLocaleString call), per the Global Constraints.
// maximumFractionDigits: 0 because every price in this product is a whole
// rupee amount (see mock-data/artworks.ts).
// Catalogue values arrive as slugs ("acrylic-on-canvas") — show them as a
// person would write them ("Acrylic on canvas").
export function humanize(slug: string): string {
  const text = slug.replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatINR(amount: number): string {
  // Smart decimals: whole rupees stay whole (marketplace cards, settlements
  // read cleanly as "₹137"); anything with real paise renders two decimals
  // ("₹285.58") so the invoice adds up by hand. Client flag 13 Nov 2026 —
  // Razorpay charges the exact paise amount, so the breakdown must show the
  // exact paise too; but forcing .00 everywhere would clutter listings that
  // never have fractional prices.
  const hasPaise = Math.abs(amount - Math.round(amount)) > 0.0049;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(amount);
}
