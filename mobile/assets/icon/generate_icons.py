"""Regenerates the launcher-icon and splash source images.

The four PNGs in this folder are build inputs, not hand-drawn artwork, so they
live here as generated output with this script as their source. Run it from
the project root, then re-run both generators:

    python3 assets/icon/generate_icons.py
    dart run flutter_launcher_icons
    dart run flutter_native_splash:create

Source: `assets/brand/gz-logo.png` — the "GZ" wordmark with the India map
illustration tucked into the `G` and a gold-gradient `Z`. Changed 4 Nov 2026
from a plain-text monogram to the real brand mark (the one the login crest
already shows), so the launcher icon and splash agree with the first screen
the person sees inside the app.

Requires Pillow.
"""

from PIL import Image

BG = (11, 10, 8, 255)  # AppColors.darkBackground
SIZE = 1024
SOURCE = "assets/brand/gz-logo.png"


def logo_on_canvas(canvas_size: int, logo_ratio: float, *, transparent: bool = False) -> Image.Image:
    """Paste the brand logo onto a square canvas, scaled so its longer edge
    is `logo_ratio` of the canvas. Background is the brand black unless
    `transparent=True` (adaptive foreground needs transparency so Android
    can composite its own background colour).

    Source cleanup (8 Nov 2026): the supplied gz-logo.png has imperfect
    background removal — faint white pixels (alpha 1-20) scattered across
    the logo's bounding box from anti-aliasing against the original white
    background. Composited onto pure black they add up to a visible
    rectangular halo (client-reported: "u can still differentiate the
    blacks of the logo and black bg"). Snap near-zero alpha to 0 before
    resizing so the splash shine sweeps only the actual mark."""
    source = Image.open(SOURCE).convert("RGBA")
    if transparent:
        pixels = source.load()
        w0, h0 = source.size
        for y in range(h0):
            for x in range(w0):
                r, g, b, a = pixels[x, y]
                if a < 24:
                    pixels[x, y] = (0, 0, 0, 0)
    target_long = round(canvas_size * logo_ratio)
    w, h = source.size
    if w >= h:
        scale = target_long / w
    else:
        scale = target_long / h
    new_w = max(1, round(w * scale))
    new_h = max(1, round(h * scale))
    logo = source.resize((new_w, new_h), Image.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0) if transparent else BG)
    canvas.alpha_composite(logo, ((canvas_size - new_w) // 2, (canvas_size - new_h) // 2))
    return canvas


def main() -> None:
    # Legacy square icon: brand logo on brand black, ~75% of the frame so
    # the India illustration is still legible on a small launcher tile.
    logo_on_canvas(SIZE, 0.75).save("assets/icon/app_icon.png")

    # Adaptive foreground: transparent background and tighter (~55%) so the
    # launcher's own circle/squircle mask doesn't clip it — Android keeps
    # only the centre ~66%.
    logo_on_canvas(SIZE, 0.55, transparent=True).save(
        "assets/icon/app_icon_foreground.png"
    )

    # Splash. Both versions draw the logo at the same physical size:
    #   Android 12+ masks the splash icon to a 192dp circle inside a 288dp
    #   box — 0.40 of 288 keeps the illustration inside the circle.
    #   Older Android + iOS draw the 1024px image at 4x, in a 256dp box —
    #   0.45 of 256 ≈ the same physical width.
    #
    # Transparent background (8 Nov 2026): the splash layer underneath is
    # already brand black, and the Flutter shine sweep passes across the
    # whole asset — a non-transparent canvas was showing up as a brighter
    # rectangle whenever the shine hit it. Transparent keeps the shimmer
    # on the mark itself, where it belongs.
    logo_on_canvas(SIZE, 0.45, transparent=True).save("assets/icon/splash.png")
    logo_on_canvas(SIZE, 0.40, transparent=True).save(
        "assets/icon/splash_android12.png"
    )


if __name__ == "__main__":
    main()
