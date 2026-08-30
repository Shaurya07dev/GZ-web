"use client";

import { useState, type FormEvent } from "react";
import { Receipt, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Standard GSTIN shape: 2-digit state code, 10-char PAN, entity number, a
// literal "Z", then a checksum character.
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Shown in every portal's Earnings & Wallet page. Optional for aggregators —
// leaving it blank is a valid answer there. Required for artists, mirroring
// the same field on their Profile page (GalleryZone won't approve listings
// without it). When a number IS entered, its shape is checked locally; there
// is no GST portal integration, which the business deliberately does not
// want.
export function GstNumberCard({
  value,
  onSave,
  isPending = false,
  isSuccess = false,
  description,
  required = false,
}: {
  value: string;
  onSave: (gstin: string) => void;
  isPending?: boolean;
  isSuccess?: boolean;
  /** Who this GST number is used for — differs by portal. */
  description: string;
  /** Artists must be GST-registered before listing; aggregators aren't. */
  required?: boolean;
}) {
  const [gstin, setGstin] = useState(value);
  const trimmed = gstin.trim();
  const invalid = required
    ? trimmed.length === 0 || !GSTIN_PATTERN.test(trimmed)
    : trimmed.length > 0 && !GSTIN_PATTERN.test(trimmed);
  const unchanged = trimmed === value.trim();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (invalid) return;
    onSave(trimmed);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
          <Receipt className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            GST number{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {required ? "(required)" : "(optional)"}
            </span>
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:max-w-sm">
        <Label htmlFor="walletGstin">GSTIN</Label>
        <Input
          id="walletGstin"
          required={required}
          maxLength={15}
          placeholder="22AAAAA0000A1Z5"
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          aria-invalid={invalid}
          className="h-10 font-mono"
        />
        {invalid ? (
          <p className="text-xs text-destructive">
            {required && trimmed.length === 0
              ? "GST registration is required."
              : required
                ? "That doesn&rsquo;t look like a valid GSTIN."
                : "That doesn&rsquo;t look like a valid GSTIN. Leave it blank if you don&rsquo;t have one."}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {required
              ? "Never shown publicly."
              : "Only if you&rsquo;re GST-registered. Never shown publicly."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={invalid || unchanged || isPending}
          className="inline-flex items-center gap-2 rounded-md border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
        >
          {value.trim() ? "Update GST number" : "Save GST number"}
        </button>
        {isSuccess && unchanged && (
          <span className="flex items-center gap-1.5 text-sm text-gold-bright">
            <Check className="size-3.5" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
