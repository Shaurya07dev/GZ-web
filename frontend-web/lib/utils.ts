import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Single shared money formatter — every ₹ amount in the app renders through
// this (never an ad-hoc toLocaleString call), per the Global Constraints.
// maximumFractionDigits: 0 because every price in this product is a whole
// rupee amount (see mock-data/artworks.ts).
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
