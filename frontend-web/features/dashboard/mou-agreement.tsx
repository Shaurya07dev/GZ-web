"use client";

import { useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { FileSignature, ShieldCheck, Check, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useArtistAccountProfile,
  useAcceptMouMutation,
} from "@/hooks/useArtistAccount";
import {
  MOU_CLAUSES,
  MOU_DECLARATION,
  MOU_PREAMBLE,
  MOU_VERSION,
} from "./mou-data";

// The artist's overall agreement with GalleryZone, signed once — not the
// per-artwork listing terms. Reading is enforced the honest way: the agree
// checkbox stays disabled until the artist has actually scrolled to the end of
// the document.
export function MouAgreement() {
  const { data: profile } = useArtistAccountProfile();
  const acceptMutation = useAcceptMouMutation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");

  const acceptance = profile?.mouAcceptance ?? null;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // 24px of slack so a trackpad that stops a hair short still counts.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReadToEnd(true);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSign) return;
    acceptMutation.mutate({
      signatureName: signature.trim(),
      version: MOU_VERSION,
    });
  }

  const nameMatches =
    profile !== undefined &&
    signature.trim().toLowerCase() === profile.fullName.trim().toLowerCase();
  const canSign = readToEnd && agreed && nameMatches;

  if (acceptance) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
              <ShieldCheck
                className="size-4 text-emerald-500"
                strokeWidth={1.75}
              />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Memorandum of Understanding
              </h2>
              <p className="text-sm text-muted-foreground">
                Signed {formatDate(acceptance.acceptedAt)} · version{" "}
                {acceptance.version}
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Accepted
          </span>
        </div>

        <div className="rounded-md border border-border bg-background/60 px-4 py-3">
          <p className="text-xs text-muted-foreground">Signed by</p>
          <p className="mt-0.5 font-display text-lg italic text-foreground">
            {acceptance.signatureName}
          </p>
        </div>

        <MouDocument onScroll={handleScroll} scrollRef={scrollRef} compact />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-lg border border-gold/30 bg-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <FileSignature className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Memorandum of Understanding
          </h2>
          <p className="text-sm text-muted-foreground">
            Your overall agreement with GalleryZone. Read it in full, then sign.
          </p>
        </div>
      </div>

      <MouDocument onScroll={handleScroll} scrollRef={scrollRef} />

      {!readToEnd && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ScrollText className="size-3.5 shrink-0" strokeWidth={1.75} />
          Scroll to the end of the document to continue.
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-3.5">
        <Checkbox
          checked={agreed}
          disabled={!readToEnd}
          onCheckedChange={(checked) => setAgreed(checked === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed text-foreground">
          I agree
          <span className="mt-1 block text-xs text-muted-foreground">
            {MOU_DECLARATION.join(" ")}
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <Label htmlFor="mouSignature">Digital signature</Label>
        <Input
          id="mouSignature"
          value={signature}
          disabled={!agreed}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={profile?.fullName ?? "Type your full name"}
          className="h-11 font-display text-lg italic"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Type your full name exactly as it appears on your profile
          {profile ? ` (${profile.fullName})` : ""}. This typed name is your
          signature, recorded with the date and MOU version.
        </p>
        {signature.trim().length > 0 && !nameMatches && (
          <p className="text-xs text-destructive">
            This doesn&rsquo;t match the name on your profile. Update your
            profile first if your legal name is different.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSign || acceptMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
        >
          Sign and accept
        </button>
        {acceptMutation.isError && (
          <span className="text-sm text-destructive">
            {acceptMutation.error instanceof Error
              ? acceptMutation.error.message
              : "Something went wrong."}
          </span>
        )}
        {acceptMutation.isSuccess && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-sm text-gold-bright"
          >
            <Check className="size-3.5" />
            Signed
          </motion.span>
        )}
      </div>
    </form>
  );
}

function MouDocument({
  scrollRef,
  onScroll,
  compact = false,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  compact?: boolean;
}) {
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      tabIndex={0}
      className={`flex flex-col gap-5 overflow-y-auto rounded-md border border-border bg-background/60 p-4 text-sm leading-relaxed sm:p-5 ${
        compact ? "max-h-64" : "max-h-96"
      }`}
    >
      <div className="flex flex-col gap-2">
        <p className="font-display text-base font-semibold text-foreground">
          Memorandum of Understanding
        </p>
        {MOU_PREAMBLE.map((p) => (
          <p key={p} className="text-muted-foreground">
            {p}
          </p>
        ))}
      </div>

      {MOU_CLAUSES.map((clause) => (
        <section key={clause.number} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {clause.number}. {clause.title}
          </h3>
          {clause.paragraphs?.map((p) => (
            <p key={p} className="text-muted-foreground">
              {p}
            </p>
          ))}
          {clause.points && (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
              {clause.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
          {clause.closing?.map((p) => (
            <p key={p} className="text-muted-foreground">
              {p}
            </p>
          ))}
        </section>
      ))}

      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-foreground">Declaration</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
          {MOU_DECLARATION.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}
