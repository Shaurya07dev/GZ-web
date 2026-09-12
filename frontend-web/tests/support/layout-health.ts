import type { Page } from '@playwright/test';

// Objective, computable signals for the things a pure overflow check misses:
// overlapping interactive elements, text clipped with no ellipsis affordance,
// and distorted (non-cover/contain) images. Not a pass/fail assertion — this
// collects candidates for visual confirmation, since geometry heuristics do
// throw false positives (e.g. decorative blur divs, intentional overlaps).
export interface LayoutIssue {
  kind: 'overlap' | 'text-clip-x' | 'text-clip-y' | 'image-distortion';
  detail: string;
}

// Known false-positive source, confirmed by direct visual check (not fixed
// here — getClientRects() per-line-fragment overlap would be the real fix,
// not attempted yet): a multi-line inline element's getBoundingClientRect()
// is the union of all its line fragments, so it can report a box that
// geometrically contains a same-row sibling's box even though the painted
// glyphs never touch (e.g. a breadcrumb link that wraps to 2 lines). Treat
// "overlap" findings involving a multi-line text link/span with a grain of
// salt and confirm visually before recording as a real issue.

export async function auditLayoutHealth(page: Page): Promise<LayoutIssue[]> {
  return page.evaluate(() => {
    const issues: { kind: string; detail: string }[] = [];
    const vw = document.documentElement.clientWidth;

    function describe(el: Element): string {
      const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
      return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}`;
    }

    // An element scrolled out of an overflow:auto/scroll/hidden ancestor's
    // visible box still has a real getBoundingClientRect() in document
    // coordinates — it can look like it "overlaps" whatever sits below that
    // container even though it's actually clipped away and invisible there.
    // Confirmed as a real false-positive source: a correctly-scrolling
    // sidebar nav flagged every item that had scrolled past its boundary as
    // "overlapping" the profile card pinned below it.
    function isClippedByScrollAncestor(el: Element): boolean {
      const r = el.getBoundingClientRect();
      const centerY = (r.top + r.bottom) / 2;
      let ancestor = el.parentElement;
      while (ancestor) {
        const cs = getComputedStyle(ancestor);
        if (cs.overflowY === 'auto' || cs.overflowY === 'scroll' || cs.overflowY === 'hidden') {
          const ar = ancestor.getBoundingClientRect();
          if (centerY < ar.top || centerY > ar.bottom) return true;
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    }

    // --- overlap: sibling-ish interactive elements whose boxes overlap
    // substantially, excluding ancestor/descendant pairs (icon-in-button etc).
    const interactive = Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]'),
    ).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const cs = getComputedStyle(el);
      return (
        cs.visibility !== 'hidden' &&
        cs.display !== 'none' &&
        Number(cs.opacity) > 0.05 &&
        !isClippedByScrollAncestor(el)
      );
    });

    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const a = interactive[i];
        const b = interactive[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
        const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
        const overlapArea = ix * iy;
        if (overlapArea === 0) continue;
        const smallerArea = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (smallerArea > 0 && overlapArea / smallerArea > 0.5) {
          issues.push({
            kind: 'overlap',
            detail: `${describe(a)} overlaps ${describe(b)} (${Math.round((overlapArea / smallerArea) * 100)}% of smaller element)`,
          });
        }
      }
    }

    // --- horizontal text clipping: single-line containers where text is
    // wider than the box, overflow hidden, and no ellipsis is set (so it's
    // silently cut off rather than visibly truncated).
    //
    // False-positive source found on P1 (dashboard-settlements): a
    // deliberately visually-hidden-but-accessible label (Tailwind's
    // `sr-only` pattern — 1x1px, clipped, `position:absolute`) reads as
    // "clipped with no ellipsis" by the same signature as a real bug, but
    // its whole point is to be invisible while staying in the a11y tree.
    // 1x1px is that pattern's signature regardless of class name, so this
    // filters on geometry, not on the literal class `sr-only`.
    const textNodes = Array.from(document.querySelectorAll('p, span, h1, h2, h3, h4, a, button, div'));
    for (const el of textNodes) {
      if (el.children.length > 0) continue; // leaf text elements only
      const text = el.textContent?.trim();
      if (!text || text.length < 3) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 && rect.height <= 1) continue; // sr-only-style hidden-but-accessible text
      const cs = getComputedStyle(el);
      if (cs.whiteSpace !== 'nowrap') continue;
      if (cs.overflow !== 'hidden' && cs.overflowX !== 'hidden') continue;
      if (cs.textOverflow === 'ellipsis') continue; // has the affordance, not a silent clip
      const range = document.createRange();
      range.selectNodeContents(el);
      const scrollW = (el as HTMLElement).scrollWidth;
      const clientW = (el as HTMLElement).clientWidth;
      if (scrollW > clientW + 2) {
        issues.push({
          kind: 'text-clip-x',
          detail: `${describe(el)} text clipped with no ellipsis: "${text.slice(0, 40)}" (scrollWidth=${scrollW} clientWidth=${clientW})`,
        });
      }
    }

    // --- image distortion: rendered aspect ratio far from natural aspect
    // ratio, without an object-fit that intentionally explains it.
    const images = Array.from(document.querySelectorAll('img')).filter((img) => img.complete && img.naturalWidth > 0);
    for (const img of images) {
      const cs = getComputedStyle(img);
      if (cs.objectFit === 'cover' || cs.objectFit === 'contain') continue;
      const r = img.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) continue;
      const naturalRatio = img.naturalWidth / img.naturalHeight;
      const renderedRatio = r.width / r.height;
      const diff = Math.abs(naturalRatio - renderedRatio) / naturalRatio;
      if (diff > 0.15) {
        issues.push({
          kind: 'image-distortion',
          detail: `${describe(img)} src=${img.currentSrc.split('/').pop()?.slice(0, 60)} natural=${img.naturalWidth}x${img.naturalHeight} rendered=${Math.round(r.width)}x${Math.round(r.height)} (${Math.round(diff * 100)}% ratio diff, object-fit=${cs.objectFit})`,
        });
      }
    }

    return issues as LayoutIssue[];
  });
}
