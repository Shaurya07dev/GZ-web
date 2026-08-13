"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

interface ArtistStoryProps {
  bio: string;
}

// The one sanctioned dangerouslySetInnerHTML exception in the app (SAD
// §8.3) — `bio` is simple rich text (<p> markup, see lib/mock-data/artists.ts)
// and is run through DOMPurify.sanitize() even against trusted fixture
// content, as a matter of habit for when real user-submitted bios arrive.
//
// DOMPurify's default export requires a real `window`/`document` (it has no
// Node/SSR fallback without a separate jsdom shim), so sanitizing has to
// happen client-side only. Sanitized HTML starts as an empty string (which
// matches what the server renders) and is filled in on mount, so there is
// no server/client markup mismatch — just a same-frame swap once JS runs.
export function ArtistStory({ bio }: ArtistStoryProps) {
  const [safeHtml, setSafeHtml] = useState("");

  useEffect(() => {
    // DOMPurify needs a real window/document, so this can only run
    // client-side post-mount — see the file-level comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSafeHtml(DOMPurify.sanitize(bio));
  }, [bio]);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground">
        Story
      </h2>
      <div
        className="prose-story mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground [&_p]:mb-3 [&_p:last-child]:mb-0"
        // eslint-disable-next-line react/no-danger -- sanctioned exception, see comment above
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </div>
  );
}
