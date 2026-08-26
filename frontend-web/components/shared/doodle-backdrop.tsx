// The client's hand-drawn pattern — faces, leaves, birds, arches — as a
// texture behind the message lists. Two artworks, not one recoloured: the
// dark plate is gold line-work on near-black, the light plate is the same
// drawing in colour on cream, so each is swapped in whole rather than
// filtered. `@custom-variant dark` in globals.css maps `dark:` onto
// next-themes' .dark class, so the swap is CSS and survives SSR without a
// flash.
//
// Opacity differs per theme on purpose. The dark plate is already
// low-contrast against its own background and needs to be turned up to read
// at all; the light plate is full-colour and would fight the text at the
// same value.
export function DoodleBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[length:520px_auto] bg-repeat opacity-[0.22] bg-[url('/backgrounds/hero-pattern-light.webp')] dark:opacity-[0.5] dark:bg-[url('/backgrounds/hero-pattern.webp')]"
    />
  );
}
