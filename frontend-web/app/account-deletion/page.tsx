import type { Metadata } from "next";
import Link from "next/link";
import { LegalLayout } from "@/features/legal/legal-layout";

export const metadata: Metadata = {
  title: "Delete Your GalleryZone Account | GalleryZone",
  description:
    "Request deletion of a GalleryZone app account and its associated personal data.",
};

const deletionEmail =
  "mailto:galleryzone@zohomail.in?subject=GalleryZone%20account%20deletion%20request&body=Please%20delete%20the%20GalleryZone%20account%20registered%20to%20this%20email%20address.";

export default function AccountDeletionPage() {
  return (
    <LegalLayout title="Delete your GalleryZone account" lastUpdated="25 October 2026">
      <article className="max-w-3xl flex-1 space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem]">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            Start a deletion request
          </h2>
          <p>
            This page applies to accounts created in the GalleryZone mobile app
            or on the GalleryZone website. Email us from the address registered
            to your account so we can verify the request.
          </p>
          <a
            href={deletionEmail}
            className="inline-flex rounded-full bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Email account-deletion request
          </a>
          <p>
            You can also initiate the same request inside the app: open your
            customer, artist or aggregator settings and select <strong>Delete account</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            What happens next
          </h2>
          <p>
            GalleryZone verifies ownership of the account, reconciles any open
            shipment, refund, payout or dispute, and confirms by email when the
            deletion is complete. Your profile, contact and payout details,
            saved preferences, submitted content and other account-linked data
            are then deleted or de-identified unless a record must be retained
            for tax, accounting, fraud prevention, provenance, dispute or other
            legal purposes.
          </p>
          <p>
            If you have an open order or money due, mention it in the request so
            the team can reconcile it to the original payment method or verified
            bank account before closure.
          </p>
        </section>

        <p>
          See the <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>{" "}
          for the categories of information GalleryZone handles and its retention practices.
        </p>
      </article>
    </LegalLayout>
  );
}
