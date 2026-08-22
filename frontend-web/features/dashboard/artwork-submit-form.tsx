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
  Building2,
  PlayCircle,
  ScrollText,
  TriangleAlert,
  Circle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  ARTWORK_RARITY_TYPES,
  LISTING_TYPES,
  MAX_ARTWORK_IMAGES,
  INSURANCE_RECOMMENDED_THRESHOLD,
  INSURANCE_PARTNER,
  ARTWORK_FORMATS,
  CUSTOMER_MARKUP_MULTIPLIER,
  PLACEHOLDER_ARTWORK_IMAGES,
} from "./artwork-submit-data";
import {
  useArtistPenalties,
  useSelfApproveArtworkMutation,
  useSubmitArtworkMutation,
  useUpdateArtworkMutation,
} from "@/hooks/useArtistArtworks";
import { DevPanel } from "@/features/auth/components/dev-panel";
import {
  AGGREGATOR_READY_FRAMING,
  FRAMING_LABEL,
  isAggregatorListed,
  type Artwork,
  type FramingState,
  type ListingType,
} from "@/types/artwork";

type FormState = {
  title: string;
  description: string;
  category: string;
  medium: string;
  rarityType: "R" | "U" | "O" | "N" | "";
  dimensions: string;
  yearCreated: string;
  artistPrice: string;
  listingType: ListingType;
  insuranceOpted: boolean;
  nfcTagId: string;
  weightKg: string;
  framing: FramingState | "";
  format: string;
  hangingHardwareIncluded: boolean;
  packagingConfirmed: boolean;
  aggregatorTermsAccepted: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  category: "",
  medium: "",
  rarityType: "",
  dimensions: "",
  yearCreated: "",
  artistPrice: "",
  listingType: "marketplace_and_aggregator",
  insuranceOpted: false,
  nfcTagId: "",
  weightKg: "",
  framing: "",
  format: "",
  hangingHardwareIncluded: false,
  packagingConfirmed: false,
  aggregatorTermsAccepted: false,
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

function Requirement({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      {met ? (
        <Check
          className="mt-0.5 size-3.5 shrink-0 text-gold-bright"
          strokeWidth={2.5}
        />
      ) : (
        <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className={met ? "text-foreground" : "text-muted-foreground"}>
        {children}
      </span>
    </li>
  );
}

export type EditableArtwork = Artwork & { artistPrice: number };

// Seeds the form from an existing listing when editing. Everything the form
// collects has a home on the artwork already, except the aggregator
// acknowledgements — those are re-confirmed on every edit rather than assumed,
// since the physical facts they attest to may have changed.
function formStateFor(artwork: EditableArtwork): FormState {
  return {
    title: artwork.title,
    description: artwork.description,
    category: artwork.category,
    medium: artwork.medium,
    rarityType: ("rarityType" in artwork ? (artwork as { rarityType?: string }).rarityType : "") as FormState["rarityType"] ?? "",
    dimensions: artwork.dimensions ?? "",
    yearCreated: artwork.yearCreated ? String(artwork.yearCreated) : "",
    artistPrice: String(artwork.artistPrice || ""),
    listingType: artwork.listingType,
    insuranceOpted: artwork.insured,
    nfcTagId: artwork.nfcTagId ?? "",
    weightKg: artwork.physical?.weightKg ? String(artwork.physical.weightKg) : "",
    framing: artwork.physical?.framing ?? "",
    format: artwork.physical?.format ?? "",
    hangingHardwareIncluded: artwork.physical?.hangingHardwareIncluded ?? false,
    packagingConfirmed: artwork.physical?.packagingConfirmed ?? false,
    aggregatorTermsAccepted: false,
  };
}

export function ArtworkSubmitForm({ artwork }: { artwork?: EditableArtwork }) {
  const isEdit = artwork !== undefined;
  const [form, setForm] = useState<FormState>(() =>
    artwork ? formStateFor(artwork) : EMPTY_FORM,
  );
  const [images, setImages] = useState<ImagePreview[]>(() =>
    artwork
      ? artwork.images.map((img, i) => ({
          id: `existing-${i}`,
          url: img.url,
          name: img.altText || `Photo ${i + 1}`,
        }))
      : INITIAL_IMAGES,
  );
  const submitMutation = useSubmitArtworkMutation();
  const updateMutation = useUpdateArtworkMutation();
  const [submitted, setSubmitted] = useState<"draft" | "review" | null>(null);
  const [submittedArtworkId, setSubmittedArtworkId] = useState<string | null>(
    null,
  );
  const [approved, setApproved] = useState(false);
  const [saved, setSaved] = useState(false);
  const selfApproveMutation = useSelfApproveArtworkMutation();

  const { data: penalties } = useArtistPenalties();
  const outstandingPenalty = (penalties ?? [])
    .filter((penalty) => penalty.settledAt === null)
    .reduce((sum, penalty) => sum + penalty.amount, 0);

  const artistPriceNumber = Number(form.artistPrice) || 0;
  // Aggregator display puts the physical piece in someone else's custody, so
  // insurance stops being a choice the moment that channel is selected.
  const aggregatorSelected = isAggregatorListed(form.listingType);
  const insuranceRequired = aggregatorSelected;

  // MOU §12: work sent to an aggregator must be framed or stretched, ship with
  // hangers, and be packed to GalleryZone's standard. Weight and format matter
  // because someone has to physically move and hang it.
  const framingOk =
    form.framing !== "" && AGGREGATOR_READY_FRAMING.has(form.framing);
  const missingForAggregator = aggregatorSelected
    ? [
        Number(form.weightKg) > 0 ? null : "weight",
        form.framing ? null : "framing",
        framingOk ? null : "framed or stretched-canvas presentation",
        form.format ? null : "artwork format",
        form.hangingHardwareIncluded ? null : "hangers included",
        form.packagingConfirmed ? null : "packing confirmation",
        form.aggregatorTermsAccepted ? null : "aggregator terms accepted",
      ].filter((v): v is string => v !== null)
    : [];
  const aggregatorReady = missingForAggregator.length === 0;
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
    // Drafts can be incomplete; a submission on the aggregator channel cannot.
    if (mode === "review" && !aggregatorReady) return;

    const payload = {
        title: form.title || "Untitled artwork",
        description: form.description,
        category: form.category,
        medium: form.medium,
        dimensions: form.dimensions,
        yearCreated: Number(form.yearCreated) || new Date().getFullYear(),
        artistPrice: artistPriceNumber,
        listingType: form.listingType,
        insuranceOpted: insuranceRequired || form.insuranceOpted,
        physical: {
          weightKg: Number(form.weightKg) || null,
          framing: form.framing || null,
          format: form.format || null,
          hangingHardwareIncluded: form.hangingHardwareIncluded,
          packagingConfirmed: form.packagingConfirmed,
        },
        nfcTagId: form.nfcTagId || null,
        images: images.map((img, i) => ({
          url: img.url,
          thumbnailUrl: img.url,
          sortOrder: i,
          altText: `${form.title || "Artwork"}, photo ${i + 1}`,
        })),
    };

    if (artwork) {
      updateMutation.mutate(
        { artworkId: artwork.id, patch: payload },
        { onSuccess: () => setSaved(true) },
      );
      return;
    }

    submitMutation.mutate(
      { ...payload, mode },
      {
        onSuccess: (artwork) => {
          setSubmittedArtworkId(artwork.id);
          setSubmitted(mode);
        },
      },
    );
  }

  if (saved) {
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
          Changes saved.
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          &ldquo;{form.title}&rdquo; has been updated.
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
          {approved
            ? "Approved and live."
            : submitted === "draft"
              ? "Saved as draft."
              : "Submitted for review."}
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {approved
            ? `“${form.title || "Your artwork"}” is on the marketplace now. Collectors can see it and buy it.`
            : submitted === "draft"
              ? `“${form.title || "Your artwork"}” has been saved. You can continue editing it any time from My Artworks.`
              : `“${form.title || "Your artwork"}” is now with our team. Verification usually takes 1–3 days. You'll be notified the moment it's approved and goes live.`}
        </p>

        {/* Demo shortcut: skip the wait so the flow can be walked end to end in
            one sitting. A curator does this in production. */}
        {submitted === "review" && !approved && submittedArtworkId && (
          <DevPanel className="mt-2 w-full max-w-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Don&rsquo;t want to wait 1&ndash;3 days?
              </p>
              <button
                type="button"
                disabled={selfApproveMutation.isPending}
                onClick={() =>
                  selfApproveMutation.mutate(submittedArtworkId, {
                    onSuccess: () => setApproved(true),
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/50 px-3 py-1.5 text-xs font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-50"
              >
                {selfApproveMutation.isPending
                  ? "Approving…"
                  : "Skip review, publish now"}
              </button>
            </div>
          </DevPanel>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/artworks"
            className="inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Back to My Artworks
          </Link>
          {approved && (
            <Link
              href={`/marketplace/${submittedArtworkId}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
            >
              View it on the marketplace
            </Link>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={(e) => handleSubmit(e, "review")}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start"
    >
      <div className="flex flex-col gap-6">
        {!isEdit && outstandingPenalty > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              strokeWidth={1.75}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                ₹{outstandingPenalty.toLocaleString("en-IN")} off-platform sale
                fee is due on this listing
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                You marked artwork as sold on another platform. The 1% fee is
                charged to your wallet when you submit this piece for review.
                Saving a draft doesn&rsquo;t trigger it.
              </p>
            </div>
          </div>
        )}

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
            <Label htmlFor="rarityType">Artwork type / rarity</Label>
            <Select
              value={form.rarityType}
              onValueChange={(value) =>
                updateField("rarityType", value as FormState["rarityType"])
              }
            >
              <SelectTrigger id="rarityType" className="h-10 w-full">
                <SelectValue placeholder="Select type">
                  {(value: string | null) =>
                    ARTWORK_RARITY_TYPES.find((r) => r.value === value)?.label ??
                    "Select type"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ARTWORK_RARITY_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <span className="font-semibold">{r.value}</span>
                    <span className="ml-1 text-muted-foreground">— {r.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              R = Rare · U = Unique · O = Original · N = Normal. Shown as a badge on your artwork card.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weightKg">Weight (kg)</Label>
              <Input
                id="weightKg"
                type="number"
                min={0}
                step="0.1"
                placeholder="3.5"
                value={form.weightKg}
                onChange={(e) => updateField("weightKg", e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="framing">Framing</Label>
              <Select
                value={form.framing}
                onValueChange={(value) =>
                  updateField("framing", (value ?? "") as FramingState | "")
                }
              >
                <SelectTrigger id="framing" className="h-10 w-full">
                  <SelectValue placeholder="Select framing">
                    {(value: string | null) =>
                      value
                        ? FRAMING_LABEL[value as FramingState]
                        : "Select framing"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FRAMING_LABEL) as FramingState[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {FRAMING_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="format">Format / surface</Label>
              <Select
                value={form.format}
                onValueChange={(value) => updateField("format", value ?? "")}
              >
                <SelectTrigger id="format" className="h-10 w-full">
                  <SelectValue placeholder="Select format">
                    {(value: string | null) =>
                      ARTWORK_FORMATS.find((f) => f.value === value)?.label ??
                      "Select format"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ARTWORK_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        </section>

        <section className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
          <h2 className="font-display text-base font-semibold text-foreground">
            Sales channel & pricing
          </h2>

          <div className="flex flex-col gap-2.5">
            <Label>Sales channel</Label>
            <p className="text-xs text-muted-foreground">
              Marketplace and Aggregator are separate channels. Pick one, or
              both.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
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

          <div className="flex flex-col gap-2 sm:max-w-xs">
            <Label htmlFor="artistPrice">Your rate (₹)</Label>
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
              Your own price for this piece. It stays private — buyers never see
              it. You receive this amount in full, less any shipping, insurance
              and taxes, paid within 7 days of a confirmed sale.
            </p>
            {artistPriceNumber > 0 && (
              <p className="flex items-baseline justify-between gap-3 rounded-md border border-gold/25 bg-gold/5 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Listed price buyers see
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-gold-bright">
                  ₹{customerPrice.toLocaleString("en-IN")}
                </span>
              </p>
            )}
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
          {aggregatorSelected && (
            <div className="flex flex-col gap-3.5 rounded-md border border-gold/30 bg-gold/5 p-4">
              <div className="flex items-center gap-2">
                <Building2
                  className="size-4 shrink-0 text-gold-bright"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-medium text-foreground">
                  Aggregator requirements
                </p>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                An aggregator holds and displays the physical piece, so it has
                to arrive ready to hang. These are required before this artwork
                can go for review.
              </p>

              <ul className="flex flex-col gap-2 text-xs">
                <Requirement met={Number(form.weightKg) > 0}>
                  Weight entered — the piece has to be moved and hung
                </Requirement>
                <Requirement met={framingOk}>
                  Framed, or professionally stretched on canvas (MOU §12)
                </Requirement>
                <Requirement met={Boolean(form.format)}>
                  Format / surface stated
                </Requirement>
              </ul>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background/60 p-3">
                <Checkbox
                  checked={form.hangingHardwareIncluded}
                  onCheckedChange={(checked) =>
                    updateField("hangingHardwareIncluded", checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  Hangers are included with the artwork.
                  <span className="mt-0.5 block text-muted-foreground">
                    Required for display — an aggregator cannot hang a piece
                    that arrives without them.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-background/60 p-3">
                <Checkbox
                  checked={form.packagingConfirmed}
                  onCheckedChange={(checked) =>
                    updateField("packagingConfirmed", checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  Packed to GalleryZone&rsquo;s shipping standard.
                  <span className="mt-0.5 block text-muted-foreground">
                    Improperly packed artworks can be rejected on arrival.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-gold/30 bg-background/60 p-3">
                <Checkbox
                  checked={form.aggregatorTermsAccepted}
                  onCheckedChange={(checked) =>
                    updateField("aggregatorTermsAccepted", checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground">
                  I accept the aggregator display terms for this artwork.
                  <span className="mt-0.5 block text-muted-foreground">
                    Initial display period is 30 days per aggregator; if unsold
                    GalleryZone may relocate the piece to another aggregator or
                    channel. Transport to the assigned aggregator is deducted
                    from your settlement after a sale.{" "}
                    <Link
                      href="/terms"
                      className="text-gold-bright hover:underline"
                    >
                      Read the full terms
                    </Link>
                    .
                  </span>
                </span>
              </label>

              {/* Placeholder for the single explainer video that sits under the
                  aggregator terms. Drop the embed in here when the file or
                  YouTube link is ready — deliberately one video, with any
                  further walkthroughs linked from Support → FAQs. */}
              <div className="flex items-center gap-3 rounded-md border border-dashed border-gold/40 px-3.5 py-3">
                <PlayCircle
                  className="size-5 shrink-0 text-gold-bright"
                  strokeWidth={1.5}
                />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    Explainer video
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    A short walkthrough of the aggregator process goes here.
                    Coming soon.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div
            className={`flex items-start justify-between gap-4 rounded-md border p-3.5 ${
              insuranceRequired ? "border-gold/40 bg-gold/5" : "border-border"
            }`}
          >
            <div>
              <Label htmlFor="insurance">
                Insure this artwork
                {insuranceRequired && (
                  <span className="ml-2 text-xs font-medium text-gold-bright">
                    Required
                  </span>
                )}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {insuranceRequired
                  ? `Mandatory for aggregator listings — the piece leaves your studio and is held by a partner while on display. Cover is arranged with ${INSURANCE_PARTNER}; the premium is deducted from your settlement.`
                  : artistPriceNumber > INSURANCE_RECOMMENDED_THRESHOLD
                    ? `Strongly recommended for a piece at this price (${INSURANCE_PARTNER}). Decline it and theft, fire, transit damage and loss are yours alone.`
                    : `Optional, arranged with ${INSURANCE_PARTNER}. Uninsured artworks carry no platform liability in transit.`}
              </p>
            </div>
            <Switch
              id="insurance"
              checked={insuranceRequired || form.insuranceOpted}
              disabled={insuranceRequired}
              onCheckedChange={(checked) =>
                updateField("insuranceOpted", checked)
              }
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border p-3.5">
            <ScrollText
              className="mt-0.5 size-4 shrink-0 text-gold-bright"
              strokeWidth={1.75}
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Certificate of Authenticity — required
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                GalleryZone issues a numbered Certificate of Authenticity for
                every accepted artwork. Nothing to fill in here: the
                certificate number is generated on approval and stays linked to
                this piece for its whole life, alongside its NFC/QR passport.
              </p>
            </div>
          </div>

        </section>

        {!aggregatorReady && (
          <p className="text-sm text-muted-foreground">
            Still needed for an aggregator listing:{" "}
            <span className="text-foreground">
              {missingForAggregator.join(", ")}
            </span>
            . You can still save this as a draft.
          </p>
        )}

        {(submitMutation.isError || updateMutation.isError) && (
          <p className="text-sm text-destructive">
            {(submitMutation.error ?? updateMutation.error) instanceof Error
              ? ((submitMutation.error ?? updateMutation.error) as Error).message
              : "Something went wrong."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={
              submitMutation.isPending ||
              updateMutation.isPending ||
              !aggregatorReady
            }
            className="group inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-6 py-3 text-sm font-semibold text-[#171310] shadow-[0_18px_40px_-14px_rgba(200,154,74,0.55)] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
          >
            {isEdit ? "Save changes" : "Submit for review"}
          </button>
          {isEdit ? (
            <Link
              href="/dashboard/artworks"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Cancel
            </Link>
          ) : (
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
          )}
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

            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Your price (private)
                </span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {artistPriceNumber > 0
                    ? `₹${artistPriceNumber.toLocaleString("en-IN")}`
                    : "N/A"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Listed price
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-gold-bright">
                  {artistPriceNumber > 0
                    ? `₹${customerPrice.toLocaleString("en-IN")}`
                    : "N/A"}
                </span>
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              You receive your price in full. The listed price is your price ×
              1.30 — that&rsquo;s what buyers see.
            </p>

            {(insuranceRequired || form.insuranceOpted) && (
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
