import { SettlementsTable } from "@/features/dashboard/settlements-table";

export const metadata = {
  title: "Settlements | GalleryZone Artist Dashboard",
};

export default function ArtistSettlementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Settlements
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          How each sale was split between your payout, aggregator commission,
          and platform fee.
        </p>
      </div>
      <SettlementsTable />
    </div>
  );
}
