import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TransferFeePayView } from "@/features/account/transfer-fee-pay-view";

export const metadata: Metadata = {
  title: "Pay the transfer fee | GalleryZone",
  description:
    "Pay GalleryZone's 5% platform fee to finalise a resale ownership transfer — 2% to the artist, 3% to GalleryZone.",
};

/**
 * /account/transfers/[transferId]/pay
 *
 * The sender's "pay the 5% fee" screen. The recipient has already
 * confirmed; this is the final step before title passes.
 */
export default async function TransferFeePayPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const { transferId } = await params;
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <TransferFeePayView transferId={transferId} />
      </main>
      <SiteFooter />
    </>
  );
}
