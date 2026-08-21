"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Camera,
  ShieldCheck,
  Building2,
  Check,
  Lock,
  Globe2,
  Video,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileUploader } from "@/components/ui/file-uploader";
import { InstagramGlyph } from "@/components/social-icons";
import {
  useArtistAccountProfile,
  useSaveArtistProfileMutation,
  useSaveArtistBankMutation,
} from "@/hooks/useArtistAccount";
import { ARTIST } from "./dashboard-data";
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

type BankFormState = {
  bankAccountNumber: string;
  ifsc: string;
};

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
  const saveBankMutation = useSaveArtistBankMutation();

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

  const [bankForm, setBankForm] = useState<BankFormState>({
    bankAccountNumber: "",
    ifsc: profile.ifsc,
  });
  const [docsSubmitted, setDocsSubmitted] = useState(false);

  function updateProfile<K extends keyof ProfileFormState>(
    field: K,
    value: ProfileFormState[K],
  ) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
    setProfileSaved(false);
  }

  function updateBank<K extends keyof BankFormState>(
    field: K,
    value: BankFormState[K],
  ) {
    setBankForm((prev) => ({ ...prev, [field]: value }));
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

  function handleBankSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    saveBankMutation.mutate(bankForm, {
      onSuccess: () => setBankForm((prev) => ({ ...prev, bankAccountNumber: "" })),
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <div className="lg:col-span-2">
        <MouAgreement />
      </div>

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
            <Label htmlFor="instagram">Instagram handle</Label>
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
            <Label htmlFor="website">Website</Label>
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
              Behind-the-scenes video (YouTube / TikTok)
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
              one for your account.
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

        <form
          onSubmit={handleBankSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="font-display text-base font-semibold text-foreground">
            Bank account
          </h2>

          <div className="flex items-center gap-3 rounded-md border border-border p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-background">
              <Building2
                className="size-4 text-gold-bright"
                strokeWidth={1.5}
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {profile.bankAccountMasked}
              </p>
              <p className="text-xs text-muted-foreground">Currently on file</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="bankAccountNumber">New account number</Label>
            <Input
              id="bankAccountNumber"
              inputMode="numeric"
              placeholder="Enter to update"
              value={bankForm.bankAccountNumber}
              onChange={(e) => updateBank("bankAccountNumber", e.target.value)}
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ifsc">IFSC code</Label>
            <Input
              id="ifsc"
              maxLength={11}
              value={bankForm.ifsc}
              onChange={(e) => updateBank("ifsc", e.target.value.toUpperCase())}
              className="h-10"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!bankForm.bankAccountNumber || saveBankMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold-bright transition-colors hover:border-gold hover:bg-gold/10 disabled:pointer-events-none disabled:opacity-40"
            >
              Update bank details
            </button>
            {saveBankMutation.isSuccess && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 text-sm text-gold-bright"
              >
                <Check className="size-3.5" />
                Updated
              </motion.span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

