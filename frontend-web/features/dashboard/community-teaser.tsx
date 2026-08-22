import { Users2 } from "lucide-react";

// A card for something that does not exist yet. It is here because the artist
// side of the platform is being built in the open and the client wants the
// next thing visible — not clickable, and honest about not being ready.
export function CommunityTeaser() {
  return (
    <section className="flex items-start gap-4 rounded-lg border border-dashed border-border bg-card p-5 sm:p-6">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
        <Users2 className="size-4 text-gold-bright" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="font-display text-base font-semibold text-foreground">
            Artist Community
          </h2>
          <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-xs font-medium text-gold-bright">
            Coming soon
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Groups, local meetups and open calls with other GalleryZone artists.
          Connections and collaborations are live today on your profile page —
          the wider community space is next.
        </p>
      </div>
    </section>
  );
}
