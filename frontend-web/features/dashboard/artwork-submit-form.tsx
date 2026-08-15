"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  ImagePlus,
  X,
  ShieldCheck,
  Info,
  Check,
  ArrowLeft,
  Nfc,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ARTWORK_CATEGORIES,
  ARTWORK_MEDIUMS,
  LISTING_TYPES,
  MAX_ARTWORK_IMAGES,
  INSURANCE_RECOMMENDED_THRESHOLD,
  CUSTOMER_MARKUP_MULTIPLIER,
  PLACEHOLDER_ARTWORK_IMAGES,
} from "./artwork-submit-data";
import { useSubmitArtworkMutation } from "@/hooks/useArtistArtworks";

type FormState = {
  title: string;
  description: string;
  category: string;
  medium: string;
  dimensions: string;
  yearCreated: string;
  artistPrice: string;
  listingType: string;
  insuranceOpted: boolean;
  coaDetails: string;
  nfcTagId: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  medium: "",
  dimensions: "",
  yearCreated: "",
  artistPrice: "",
  listingType: "marketplace_and_aggregator",
  insuranceOpted: false,
  coaDetails: "",
  nfcTagId: "",
};

type ImagePreview = { id: string; url: string; name: string };

// Uploads never block submit — every slot starts filled with a stock photo
// (no backend to store a real one either way); picking a real file just
// swaps a slot's placeholder for a real preview.
const INITIAL_IMAGES: ImagePreview[] = PLACEHOLDER_ARTWORK_IMAGES.map(
  (url, i) => ({ id: `placeholder-${i}`, url, name: `Stock photo ${i + 1}` }),
);

function generateNfcTagId(): string {
  return `NFC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function ArtworkSubmitForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [images, setImages] = useState<ImagePreview[]>(INITIAL_IMAGES);
  const submitMutation = useSubmitArtworkMutation();
  const [submitted, setSubmitted] = useState<"draft" | "review" | null>(null);

  const artistPriceNumber = Number(form.artistPrice) || 0;
  const customerPrice = useMemo(
    () => Math.round(artistPriceNumber * CUSTOMER_MARKUP_MULTIPLIER),
    [artistPriceNumber],
  );

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddImages(fileList: FileList | null) {
    if (!fileList) return;
    const remaining = MAX_ARTWORK_IMAGES - images.length;
    const files = Array.from(fileList).slice(0, remaining);
    const next = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      url: URL.createObjectURL(file),
      name: file.name,
    }));
    setImages((prev) => [...prev, ...next]);
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  function handleSubmit(
    e: FormEvent<HTMLFormElement>,
    mode: "draft" | "review",
  ) {
    e.preventDefault();
    submitMutation.mutate(
      {
        title: form.title || "Untitled artwork",
        description: form.description,
        category: form.category,
        medium: form.medium,
        dimensions: form.dimensions,
        yearCreated: Number(form.yearCreated) || new Date().getFullYear(),
        artistPrice: artistPriceNumber,
        listingType: form.listingType as
          | "marketplace_only"
          | "marketplace_and_aggregator",
        insuranceOpted: form.insuranceOpted,
        coaDetails: form.coaDetails,
        nfcTagId: form.nfcTagId || null,
        images: images.map((img, i) => ({
          url: img.url,
          thumbnailUrl: img.url,
          sortOrder: i,
          altText: `${form.title || "Artwork"}, photo ${i + 1}`,
        })),
        mode,
      },
      { onSuccess: () => setSubmitted(mode) },
    );
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-start gap-3 rounded-lg border border-gold/30 bg-card p-8"
      >
        <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <Check className="size-5 text-gold-bright" />
        </span>
        <h2 className="font-display text-xl font-semibold text-foreground">
          {submitted === "draft" ? "Saved as draft." : "Submitted for review."}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {submitted === "draft"
            ? `“${form.title || "Your artwork"}” has been saved. You can continue editing it any time from My Artworks.`
            : `“${form.title || "Your artwork"}” is now with our team. Verification usually takes 1–3 days. You'll be notified the moment it's approved and goes live.`}
        </p>
        <Link
          href="/dashboard/artworks"
          className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to My Artworks
        </Link>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e, "review")}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start"
    >
      <div className="flex flex-col gap-6">
        <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-foreground">
            Artwork images
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {MAX_ARTWORK_IMAGES} photos, cover image first. Slots start
            filled with placeholders — remove one and add a real photo to
            replace it.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-border"
              >
                <Image
                  src={img.url}
                  alt={img.name}
                  fill
                  sizes="140px"
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  aria-label={`Remove ${img.name}`}
                  className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-background/85 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}

            {images.length < MAX_ARTWORK_IMAGES && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-gold/50 hover:text-gold-bright">
                <ImagePlus className="size-5" />
                <span className="text-[11px]">Add photo</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => handleAddImages(e.target.files)}
                />
              </label>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {images.length} / {MAX_ARTWORK_IMAGES} uploaded
          </p>
        </section>

        <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-foreground">
            Artwork details
          </h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              minLength={3}
              maxLength={200}
              placeholder="Monsoon Over Madurai"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Oil on canvas, painted during the 2025 monsoon season."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              className="min-h-28 resize-none"
            />
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              Don&rsquo;t mention price here. Your listed price stays private
              and only the marketplace price is shown to buyers.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => updateField("category", value ?? "")}
              >
                <SelectTrigger id="category" className="h-10 w-full">
                  <SelectValue placeholder="Select category">
                    {(value: string | null) =>
                      ARTWORK_CATEGORIES.find((c) => c.value === value)
                        ?.label ?? "Select category"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ARTWORK_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="medium">Medium</Label>
              <Select
                value={form.medium}
                onValueChange={(value) => updateField("medium", value ?? "")}
              >
                <SelectTrigger id="medium" className="h-10 w-full">
                  <SelectValue placeholder="Select medium">
                    {(value: string | null) =>
                      ARTWORK_MEDIUMS.find((m) => m.value === value)?.label ??
                      "Select medium"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ARTWORK_MEDIUMS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="dimensions">Dimensions</Label>
              <Input
                id="dimensions"
                placeholder="24 x 36 in"
                value={form.dimensions}
                onChange={(e) => updateField("dimensions", e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="year">Year created</Label>
              <Input
                id="year"
                type="number"
                min={1900}
                max={2100}
                placeholder="2025"
                value={form.yearCreated}
                onChange={(e) => updateField("yearCreated", e.target.value)}
                className="h-10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nfcTagId">NFC / QR tag ID</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Nfc className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="nfcTagId"
                  placeholder="Scan or enter the physical tag ID"
                  value={form.nfcTagId}
                  onChange={(e) => updateField("nfcTagId", e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
              <button
                type="button"
                onClick={() => updateField("nfcTagId", generateNfcTagId())}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold-bright"
              >
                <RefreshCw className="size-3.5" />
                Generate
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Links this piece&rsquo;s physical tag to its digital passport.
              Leave blank if you haven&rsquo;t attached one yet.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-foreground">
            Pricing & listing
          </h2>

          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="artistPrice">Your price (₹)</Label>
            <Input
              id="artistPrice"
              type="number"
              min={1}
              step={1}
              placeholder="18000"
              value={form.artistPrice}
              onChange={(e) => updateField("artistPrice", e.target.value)}
              className="h-10"
            />
            <p className="text-xs text-muted-foreground">
              This stays private. You receive 100% of this amount, paid within 7
              days of a confirmed sale.
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <Label>Listing type</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {LISTING_TYPES.map((option) => {
                const active = form.listingType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => updateField("listingType", option.value)}
                    className={`rounded-md border p-3.5 text-left transition-colors ${
                      active
                        ? "border-gold/50 bg-gold/10"
                        : "border-border hover:border-gold/30"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${active ? "text-gold-bright" : "text-foreground"}`}
                    >
                      {option.label}
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3.5">
            <div>
              <Label htmlFor="insurance">Insure this artwork</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {artistPriceNumber > INSURANCE_RECOMMENDED_THRESHOLD
                  ? "Recommended for pieces valued above ₹20,000, and required for gallery display."
                  : "Optional below ₹20,000, required if a gallery displays this artwork physically."}
              </p>
            </div>
            <Switch
              id="insurance"
              checked={form.insuranceOpted}
              onCheckedChange={(checked) =>
                updateField("insuranceOpted", checked)
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="coa">Certificate of authenticity notes</Label>
            <Textarea
              id="coa"
              rows={2}
              placeholder="Signed on reverse."
              value={form.coaDetails}
              onChange={(e) => updateField("coaDetails", e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
        </section>

        {submitMutation.isError && (
          <p className="text-sm text-destructive">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "Something went wrong."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="group inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-6 py-3 text-sm font-semibold text-[#171310] shadow-[0_18px_40px_-14px_rgba(200,154,74,0.55)] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
          >
            Submit for review
          </button>
          <button
            type="button"
            disabled={submitMutation.isPending}
            onClick={(e) =>
              handleSubmit(e as unknown as FormEvent<HTMLFormElement>, "draft")
            }
            className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-60"
          >
            Save as draft
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <div className="overflow-hidden rounded-lg border border-gold/25 bg-card">
          <div className="relative aspect-[4/3] bg-secondary">
            {images[0] ? (
              <Image
                src={images[0].url}
                alt={form.title || "Artwork preview"}
                fill
                sizes="360px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImagePlus className="size-8 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="p-5">
            <p className="text-xs font-medium tracking-[0.1em] text-gold-bright">
              LIVE PREVIEW
            </p>
            <h3 className="mt-2 truncate font-display text-lg font-semibold text-foreground">
              {form.title || "Untitled artwork"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {ARTWORK_MEDIUMS.find((m) => m.value === form.medium)?.label ??
                "Medium"}
              {form.yearCreated ? ` · ${form.yearCreated}` : ""}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">
                Marketplace price
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {artistPriceNumber > 0
                  ? `₹${customerPrice.toLocaleString("en-IN")}`
                  : "N/A"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Your price × 1.30: this is what collectors see.
            </p>

            {form.insuranceOpted && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold-bright">
                <ShieldCheck className="size-3.5 shrink-0" />
                Insured artwork
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
