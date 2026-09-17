"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Root-level error boundary: the only place a crash in the root layout can
// be caught. Reports to Sentry and offers a reload.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f1ea", color: "#1a1410", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "20vh auto", padding: "0 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#6b635c", marginBottom: 24 }}>We&rsquo;ve been notified. Please try again.</p>
          <button type="button" onClick={reset} style={{ background: "#b8892b", color: "#fff", border: 0, borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
