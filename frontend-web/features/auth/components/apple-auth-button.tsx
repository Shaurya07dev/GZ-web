"use client";

import { toast } from "sonner";

function AppleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" {...props}>
      <path d="M16.365 1.43c0 1.14-.417 2.06-1.25 2.86-.995.95-2.13 1.5-3.4 1.4-.06-1.1.42-2.13 1.25-2.9.9-.85 2.1-1.4 3.4-1.36zm3.3 16.7c-.55 1.27-.81 1.84-1.53 2.96-1 1.55-2.4 3.48-4.16 3.5-1.55.02-1.95-1-4.05-1-2.1 0-2.54.98-4.09 1.02-1.75.05-3.08-1.68-4.08-3.22C-.4 17.5-.9 12.1 1.15 9.02c1.02-1.53 2.62-2.42 4.13-2.42 1.68 0 2.74 1.05 4.05 1.05 1.28 0 2.13-1.06 4.05-1.06 1.34 0 2.75.73 3.76 1.99-3.3 1.8-2.76 6.5.06 7.55z" />
    </svg>
  );
}

// Mirrors GoogleAuthButton: no real Apple Sign-In wiring in this mock
// phase, so it stays an honest, styled dead end.
export function AppleAuthButton() {
  return (
    <button
      type="button"
      onClick={() =>
        toast.info("Apple sign-in isn't wired up in this demo yet.")
      }
      className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
    >
      <AppleIcon className="text-base" />
      Apple
    </button>
  );
}
