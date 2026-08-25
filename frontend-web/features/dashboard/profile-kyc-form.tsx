"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  ShieldCheck,
  Check,
  Lock,
  Globe2,
  Video,
  ChevronRight,
  Receipt,
  Truck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/ui/file-uploader";
import { InstagramGlyph } from "@/components/social-icons";
import {
  useArtistAccountProfile,
  useSaveArtistProfileMutation,
} from "@/hooks/useArtistAccount";
import { ARTIST } from "./dashboard-data";
import { ArtistNetworkPanel } from "./artist-network-panel";
import { ArtistProfileSummary } from "./artist-profile-summary";
import { MouAgreement } from "./mou-agreement";

// Standard GSTIN shape: 2-digit state code, 10-char PAN, entity number, a
// literal "Z", then a checksum character.
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

type ProfileFormState = {
  fullName: string;
  email: string;
  phone: string;
  bio: string;
  instagram: string;
  website: string;
  socialProofVideoUrl: string;
  gstin: string;
};

type PickupFormState = {
  pickupLine1: string;
  pickupLine2: string;
  pickupCity: string;
  pickupState: string;
  pickupPincode: string;
};

// Six digits, and the first can't be 0 — no Indian pincode starts with one.
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

type ArtistAccountProfile = NonNullable<
  ReturnType<typeof useArtistAccountProfile>["data"]
>;

// Fetches, then hands off to ProfileKycFormBody once loaded — the body's
// local form state is seeded straight from `profile` in its useState
// initializer (no effect needed) because the body only ever mounts after
// `profile` exists, matching every other query-backed form in this codebase.
export function ProfileKycForm() {
  const { data: profile } = useArtistAccountProfile();

  if (!profile) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
        <div className="h-96 animate-pulse rounded-lg border border-border bg-card" />
      </div>
    );
  }

  return <ProfileKycFormBody profile={profile} />;
}

function ProfileKycFormBody({ profile }: { profile: ArtistAccountProfile }) {
  const saveProfileMutation = useSaveArtistProfileMutation();

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    bio: profile.bio,
    instagram: profile.instagram,
    website: profile.website,
    socialProofVideoUrl: profile.socialProofVideoUrl ?? "",
    gstin: profile.gstin ?? "",
  });
  const [profileSaved, setProfileSaved] = useState(false);

  const [pickupForm, setPickupForm] = useState<PickupFormState>({
    pickupLine1: profile.pickupLine1 ?? "",
    pickupLine2: profile.pickupLine2 ?? "",
    pickupCity: profile.pickupCity ?? "",
    pickupState: profile.pickupState ?? "",
    pickupPincode: profile.pickupPincode ?? "",
  });
  const [pickupSaved, setPickupSaved] = useState(false);

  function updatePickup<K extends keyof PickupFormState>(
    field: K,
    value: PickupFormState[K],
  ) {
    setPickupForm((prev) => ({ ...prev, [field]: value }));
    setPickupSaved(false);
  }

  const pincodeInvalid =
    pickupForm.pickupPincode.trim().length > 0 &&
    !PINCODE_PATTERN.test(pickupForm.pickupPincode.trim());
  const pickupComplete =
    pickupForm.pickupLine1.trim() !== "" &&
    pickupForm.pickupCity.trim() !== "" &&
    pickupForm.pickupState.trim() !== "" &&
    PINCODE_PATTERN.test(pickupForm.pickupPincode.trim());

  function handlePickupSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pincodeInvalid) return;
    saveProfileMutation.mutate(pickupForm, {
      onSuccess: () => setPickupSaved(true),
    });
  }

  const [docsSubmitted, setDocsSubmitted] = useState(false);

  // Signing reorders this page (unsigned artists get the agreement first)
  // and is what unlocks proposing a collaboration.
  const mouSigned = profile.mouAcceptance !== null;

  function updateProfile<K extends keyof ProfileFormState>(
    field: K,
    value: ProfileFormState[K],
  ) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setProfileSaved(false);
  }

  // GSTIN is optional. When one IS entered we check its shape locally (2-digit
  // state code, PAN, entity digit, Z, checksum char) — no GST portal
  // integration, which the business deliberately does not want.
  const gstinInvalid =
    profileForm.gstin.trim().length > 0 && !GSTIN_PATTERN.test(profileForm.gstin.trim());

  function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (gstinInvalid) return;
    saveProfileMutation.mutate(
      { ...profileForm, socialProofVideoUrl: profileForm.socialProofVideoUrl || null },
      { onSuccess: () => setProfileSaved(true) },
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      {/* The MOU leads the page until it is signed — it is the one thing an
          artist has to do here. Once signed it moves to the bottom (below),
          where it stays as reference rather than a task. */}
      {!mouSigned && (
        <div className="lg:col-span-2">
          <MouAgreement />
        </div>
      )}

      {/* Both halves of their profile, side by side and labelled — the one
          place the public and private figures legitimately appear together. */}
      <ArtistProfileSummary location={ARTIST.location} />

      <Link
        href="/dashboard/verification"
        className="flex items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm font-medium text-gold-bright transition-colors hover:bg-gold/10 lg:col-span-2"
      >
        View verification status
        <ChevronRight className="size-4" />
      </Link>

      <form
        onSubmit={handleProfileSubmit}
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="font-display text-base font-semibold text-foreground">
          Public profile
        </h2>

        <div className="flex items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-gold/40">
            <Image
              src={ARTIST.avatar}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
            <button
              type="button"
              aria-label="Change photo"
              className="absolute inset-0 flex items-center justify-center bg-background/0 text-transparent transition-colors hover:bg-background/60 hover:text-foreground"
            >
              <Camera className="size-4" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Profile photo</p>
            <p className="text-xs text-muted-foreground">
              Shown on your public artist page.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              required
              value={profileForm.fullName}
              onChange={(e) => updateProfile("fullName", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={profileForm.email}
              onChange={(e) => updateProfile("email", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={profileForm.phone}
              onChange={(e) => updateProfile("phone", e.target.value)}
              className="h-10 sm:max-w-xs"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={4}
            placeholder="Tell collectors about your practice."
            value={profileForm.bio}
            onChange={(e) => updateProfile("bio", e.target.value)}
            className="min-h-28 resize-none"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="instagram">
              Instagram handle{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="relative">
              <InstagramGlyph className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="instagram"
                placeholder="yourhandle"
                value={profileForm.instagram}
                onChange={(e) => updateProfile("instagram", e.target.value)}
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="website">
              Website{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="relative">
              <Globe2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="website"
                placeholder="yoursite.com"
                value={profileForm.website}
                onChange={(e) => updateProfile("website", e.target.value)}
                className="h-10 pl-9"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="socialProofVideoUrl">
              Behind-the-scenes video (YouTube / TikTok){" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="relative">
              <Video className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="socialProofVideoUrl"
                placeholder="https://youtube.com/watch?v=..."
                value={profileForm.socialProofVideoUrl}
                onChange={(e) =>
                  updateProfile("socialProofVideoUrl", e.target.value)
                }
                className="h-10 pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A studio or process video collectors can watch as proof of your
              practice.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="gstin">
              GSTIN{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <div className="relative sm:max-w-xs">
              <Receipt className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="gstin"
                maxLength={15}
                placeholder="22AAAAA0000A1Z5"
                value={profileForm.gstin}
                onChange={(e) =>
                  updateProfile("gstin", e.target.value.toUpperCase())
                }
                aria-invalid={gstinInvalid}
                className="h-10 pl-9 font-mono"
              />
            </div>
            {gstinInvalid ? (
              <p className="text-xs text-destructive">
                That does not look like a valid GSTIN. Leave it blank if you
                do not have one.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only if you are GST-registered. Used by GalleryZone for
                invoicing and settlement — never shown on your public profile
                or to buyers.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveProfileMutation.isPending || gstinInvalid}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
          >
            Save profile
          </button>
          {profileSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-sm text-gold-bright"
            >
              <Check className="size-3.5" />
              Saved
            </motion.span>
          )}
        </div>
      </form>

      {/* Its own card, and its own save, because it is the opposite of the one
          above: the public profile is what buyers see, this is what only a
          courier ever sees. Without a pincode here no delivery can be priced —
          Shiprocket quotes on the distance between two of them. */}
      <form
        onSubmit={handlePickupSubmit}
        className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6 lg:order-last lg:col-span-2"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
            <Truck className="size-4 text-gold-bright" strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Pickup address
            </h2>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              Where your work is collected from. Private — buyers never see it.
            </p>
          </div>
        </div>

        {!pickupComplete && (
          <p className="rounded-md border border-gold/30 bg-gold/5 px-3.5 py-2.5 text-xs leading-relaxed text-gold-bright">
            Add this before your first sale. Delivery is priced on the distance
            between your address and the buyer&rsquo;s, so without it we
            can&rsquo;t quote a shipping cost for your work.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="pickupLine1">Address</Label>
          <Input
            id="pickupLine1"
            placeholder="House / studio number and street"
            value={pickupForm.pickupLine1}
            onChange={(e) => updatePickup("pickupLine1", e.target.value)}
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="pickupLine2">
            Area, landmark{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            id="pickupLine2"
            placeholder="Locality or a nearby landmark"
            value={pickupForm.pickupLine2}
            onChange={(e) => updatePickup("pickupLine2", e.target.value)}
            className="h-10"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pickupCity">City</Label>
            <Input
              id="pickupCity"
              placeholder="Udaipur"
              value={pickupForm.pickupCity}
              onChange={(e) => updatePickup("pickupCity", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pickupState">State</Label>
            <Input
              id="pickupState"
              placeholder="Rajasthan"
              value={pickupForm.pickupState}
              onChange={(e) => updatePickup("pickupState", e.target.value)}
              className="h-10"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pickupPincode">PIN code</Label>
            <Input
              id="pickupPincode"
              inputMode="numeric"
              maxLength={6}
              placeholder="313001"
              value={pickupForm.pickupPincode}
              onChange={(e) =>
                updatePickup(
                  "pickupPincode",
                  e.target.value.replace(/[^0-9]/g, ""),
                )
              }
              aria-invalid={pincodeInvalid}
              className="h-10 font-mono"
            />
            {pincodeInvalid && (
              <p className="text-xs text-destructive">
                A PIN code is six digits.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saveProfileMutation.isPending || pincodeInvalid}
            className="inline-flex items-center gap-2 rounded-md border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
          >
            Save pickup address
          </button>
          {pickupSaved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-sm text-gold-bright"
            >
              <Check className="size-3.5" />
              Saved
            </motion.span>
          )}
        </div>
      </form>

      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              Aadhaar verification
            </h2>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <ShieldCheck className="size-3" />
              Verified
            </span>
          </div>
          <p className="mt-3 flex items-center gap-2 font-mono text-sm text-foreground">
            <Lock className="size-3.5 text-muted-foreground" />
            {profile.aadhaarMasked}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Encrypted at rest and used only for identity verification. Contact
            support to update your Aadhaar details.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:p-6">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Identity documents
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Submit an additional ID or address proof if support has requested
              one for your account. PAN is preferred{" "}
              <span className="text-muted-foreground/80">(optional)</span>.
            </p>
          </div>

          <FileUploader
            title="Upload documents"
            acceptedFormats={["jpg", "pdf", "svg", "png", "docx"]}
            maxFiles={3}
            maxSizeMB={10}
            submitLabel="Submit for review"
            onSubmit={() => setDocsSubmitted(true)}
            className="max-w-none shadow-none ring-1 ring-border"
          />

          {docsSubmitted && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-sm text-gold-bright"
            >
              <Check className="size-3.5" />
              Submitted for review
            </motion.p>
          )}
        </div>
      </div>

      <ArtistNetworkPanel mouSigned={mouSigned} />

      {mouSigned && (
        <div className="lg:col-span-2">
          <MouAgreement />
        </div>
      )}
    </div>
  );
}

