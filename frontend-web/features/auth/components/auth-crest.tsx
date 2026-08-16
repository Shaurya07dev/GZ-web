// Centered wordmark shown atop the form card on every Auth screen — distinct
// from AuthLayoutPanel's small top-left Wordmark, which lives in the
// separate artwork showcase panel and stays untouched.
export function AuthCrest() {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="font-display text-4xl font-semibold text-gold-bright italic">
        GZ
      </span>
      <span className="text-sm font-medium tracking-[0.25em] text-foreground">
        GALLERYZONE
      </span>
      <span className="text-[0.65rem] tracking-[0.3em] text-muted-foreground">
        ART CONNECTS
      </span>
      <span className="mt-2 h-px w-10 bg-gold/60" />
    </div>
  );
}
