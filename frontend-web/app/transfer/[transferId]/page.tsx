import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TransferAcceptView } from "@/features/verify/transfer-accept-view";

export const metadata: Metadata = {
  title: "Accept artwork ownership | GalleryZone",
  description:
    "Accept the transfer of an artwork's digital ownership record on GalleryZone.",
};

// Public on purpose: the incoming owner may not have an account yet, and the
// page shows only what they need to accept the hand-over.
export default async function TransferPage({
  params,
}: PageProps<"/transfer/[transferId]">) {
  const { transferId } = await params;
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <TransferAcceptView transferId={transferId} />
      </main>
      <SiteFooter />
    </>
  );
}
