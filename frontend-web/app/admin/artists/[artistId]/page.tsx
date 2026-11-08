"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { AdminPageHeader } from "@/features/admin/admin-page-header";
import { UserDetailHeader } from "@/features/admin/people/user-detail-header";
import { AdminStatusBadge } from "@/features/admin/admin-status-badge";
import { InstagramGlyph } from "@/components/social-icons";
import { Button } from "@/components/ui/button";
import {
  useAdminArtistPortfolio,
  useSetUserEarningsAbove5LMutation,
} from "@/hooks/useAdminUsers";
import { verifiedTierCount } from "@/types/artist";
import { formatINR } from "@/lib/utils";
import type { AdminUser } from "@/types/admin";

const TIER_LABELS = [
  { key: "tier1SocialMedia", label: "Tier 1 · Social media linked" },
  { key: "tier2ActivePlan", label: "Tier 2 · Artist agreement" },
  { key: "tier3FirstSale", label: "Tier 3 · First confirmed sale" },
] as const;

export default function AdminArtistDetailPage(
  props: PageProps<"/admin/artists/[artistId]">,
) {
  const { artistId } = use(props.params);
  const { data, isLoading } = useAdminArtistPortfolio(artistId);

  if (isLoading) return null;
  if (!data) notFound();

  const { user, profile, artworks } = data;
  const tier = profile ? verifiedTierCount(profile.verification) : 0;
  const listedValue = artworks.reduce((sum, a) => sum + a.customerPrice, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={user.name}
        description="Artist record, verification standing, and catalogue."
        backHref="/admin/artists"
        backLabel="Back to artists"
      />

      <UserDetailHeader user={user} />

      {/* grid-cols-1 below lg isn't decorative — see app/admin/page.tsx's
          identical comment: an implicit grid track sizes to its widest
          child's min-content instead of shrinking, overflowing the page. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-base font-semibold text-foreground">
                Verification
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground">
                {tier} of 3
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {TIER_LABELS.map((entry) => {
                const cleared = profile
                  ? profile.verification[entry.key]
                  : false;
                return (
                  <li key={entry.key} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`size-2 shrink-0 rounded-full ${cleared ? "bg-gold-bright" : "bg-border"}`}
                    />
                    <span
                      className={`text-sm ${cleared ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {entry.label}
                    </span>
                  </li>
                );
              })}
            </ul>
            {tier === 3 ? (
              <p className="mt-4 rounded-md border border-gold/40 bg-gold/[0.06] p-3 text-xs text-muted-foreground">
                Fully verified. Carries the Gold badge across the marketplace.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold text-foreground">
              KYC
            </h2>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Identity check
              </span>
              {user.kycStatus ? (
                <AdminStatusBadge status={user.kycStatus} size="sm" />
              ) : (
                <span className="text-sm text-muted-foreground">Not set</span>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Identity documents are never exposed in this console. Review
              submissions from the KYC queue.
            </p>
          </section>

          <ComplianceSection user={user} />

          <TdsSection user={user} />

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold text-foreground">
              Catalogue
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">Works listed</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-foreground">
                  {artworks.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Listed value</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-foreground">
                  {formatINR(listedValue)}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="font-display text-base font-semibold text-foreground">
              Works by this artist
            </h2>
          </div>
          {artworks.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Nothing listed yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {artworks.map((artwork) => (
                <li key={artwork.id}>
                  <Link
                    href={`/admin/artworks/${artwork.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {artwork.images[0] ? (
                        <Image
                          src={artwork.images[0].thumbnailUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {artwork.title}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {artwork.category}
                      </p>
                    </div>
                    <AdminStatusBadge status={artwork.status} size="sm" />
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatINR(artwork.customerPrice)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// PAN, GST and Instagram are admin-only — none of these ever appear on the
// artist's public profile page. Shown together here since they're the same
// kind of thing: compliance detail collected from the artist, reviewed by
// GalleryZone rather than shown to buyers.
/**
 * §194-O TDS flag toggle. Shown on artist-only pages (hidden for aggregators
 * and customers). Backend's GET users/:id returns `earningsAbove5LSuggested`
 * as an advisory — "the gross for this artist this financial year looks
 * like it's over ₹5L" — but the admin still confirms before any TDS
 * withholding changes on subsequent settlements. Added 9 Nov 2026 after
 * the backend audit found the PATCH endpoint had no UI caller.
 */
function TdsSection({ user }: { user: AdminUser }) {
  const mutation = useSetUserEarningsAbove5LMutation();
  if (user.role !== "artist") return null;

  const on = Boolean(user.earningsAbove5L);
  const suggested = user.earningsAbove5LSuggested;
  const mismatch = suggested !== null && suggested !== undefined && suggested !== on;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-foreground">
          TDS threshold
        </h2>
        <span className="text-xs text-muted-foreground">§194-O</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Once this artist&apos;s financial-year gross crosses ₹5 lakh, India
        requires GalleryZone withholds 1% at source on subsequent
        settlements. This flag drives that withholding. Flip it after
        reading the system&apos;s suggestion, not before.
      </p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {on ? "Above ₹5L — withholding 1%" : "Below threshold — no withholding"}
          </p>
          {suggested !== null && suggested !== undefined && (
            <p
              className={`mt-0.5 text-xs ${
                mismatch ? "text-red-400" : "text-muted-foreground"
              }`}
            >
              {mismatch
                ? `System suggests ${suggested ? "above" : "below"} — review`
                : `System agrees (${suggested ? "above" : "below"})`}
            </p>
          )}
        </div>
        <Button
          variant={on ? "outline" : "default"}
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate(
              { userId: user.id, value: !on },
              {
                onSuccess: () =>
                  toast.success(
                    on ? "Below-threshold set" : "Above-threshold set",
                  ),
                onError: (error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not update",
                  ),
              },
            )
          }
        >
          {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
          {on ? "Mark below ₹5L" : "Mark above ₹5L"}
        </Button>
      </div>
    </section>
  );
}

function ComplianceSection({ user }: { user: AdminUser }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold text-foreground">
        Compliance
      </h2>
      <dl className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm text-muted-foreground">PAN</dt>
          <dd className="font-mono text-sm text-foreground">
            {user.pan ?? "Not on file"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm text-muted-foreground">GSTIN</dt>
          <dd className="font-mono text-sm text-foreground">
            {user.gstin ?? "Not on file"}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-sm text-muted-foreground">GST status</dt>
          <dd>
            <AdminStatusBadge
              status={user.gstStatus ?? "not_submitted"}
              size="sm"
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <InstagramGlyph className="size-3.5" />
            Instagram
          </dt>
          <dd className="text-sm text-foreground">
            {user.instagramHandle
              ? `@${user.instagramHandle}`
              : "Not connected"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
