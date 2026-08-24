"use client";

import { useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  FileSignature,
  ShieldCheck,
  Check,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// One signing surface for both Memoranda of Understanding — the artist's and
// the aggregator's. They are different documents with the same mechanics: read
// the whole thing, agree, sign with your own name. The caller supplies the
// document and owns the mutation; this component owns the reading and signing.

export interface MouClause {
  number: number;
  title: string;
  /** Lead paragraphs, rendered before any list. */
  paragraphs?: string[];
  /** Bulleted items. */
  points?: string[];
  /** Closing paragraphs, rendered after the list. */
  closing?: string[];
}

export interface MouDocument {
  title: string;
  version: string;
  intro: string;
  preamble: string[];
  clauses: MouClause[];
  declaration: string[];
}

export interface MouAcceptanceRecord {
  acceptedAt: string;
  signatureName: string;
  version: string;
}

export function MouAgreement({
  document,
  signerName,
  acceptance,
  onSign,
  isPending = false,
  error,
  isSuccess = false,
}: {
  document: MouDocument;
  /** The name the signature has to match — profile name or business contact. */
  signerName: string;
  acceptance: MouAcceptanceRecord | null;
  onSign: (input: { signatureName: string; version: string }) => void;
  isPending?: boolean;
  error?: unknown;
  isSuccess?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // 24px of slack so a trackpad that stops a hair short still counts.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setReadToEnd(true);
    }
  }

  const nameMatches =
    signature.trim().toLowerCase() === signerName.trim().toLowerCase();
  const canSign = readToEnd && agreed && nameMatches;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSign) return;
    onSign({ signatureName: signature.trim(), version: document.version });
  }

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
                {document.title}
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

        {/* Once signed, the document itself is reference material rather than
            something to read — it collapses so the rest of the profile is not
            pushed a screen down. <details> rather than state: the browser
            already does this, including keyboard and find-in-page. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-gold-bright transition-colors hover:text-gold">
            <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            Read the agreement
          </summary>
          <div className="mt-3">
            <MouBody
              document={document}
              scrollRef={scrollRef}
              onScroll={handleScroll}
              compact
            />
          </div>
        </details>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-gold/30 bg-card p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <FileSignature
            className="size-4 text-gold-bright"
            strokeWidth={1.75}
          />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            {document.title}
          </h2>
          <p className="text-sm text-muted-foreground">{document.intro}</p>
        </div>
      </div>

      <SigningSteps readDone={readToEnd} agreeDone={agreed} signDone={isSuccess} />

      <div className="relative">
        <MouBody
          document={document}
          scrollRef={scrollRef}
          onScroll={handleScroll}
        />
        {!readToEnd && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center rounded-b-md bg-gradient-to-t from-background/95 via-background/60 to-transparent pb-2 pt-8">
            <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-card px-3 py-1 text-xs font-medium text-gold-bright shadow-sm">
              <ChevronDown className="size-3.5 shrink-0 animate-bounce" strokeWidth={2} />
              Scroll to the end to continue
            </span>
          </div>
        )}
      </div>

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
            {document.declaration.join(" ")}
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
          placeholder={signerName}
          className="h-11 font-display text-lg italic"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Type your full name exactly as it appears on your profile (
          {signerName}). This typed name is your signature, recorded with the
          date and document version.
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
          disabled={!canSign || isPending}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
        >
          Sign and accept
        </button>
        {Boolean(error) && (
          <span className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Something went wrong."}
          </span>
        )}
        {isSuccess && (
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

// Small progress cue so a first-time signer knows where they are in the
// read -> agree -> sign flow before they've done any of it, rather than
// discovering the rules (must scroll, must type your name) one disabled
// control at a time.
function SigningSteps({
  readDone,
  agreeDone,
  signDone,
}: {
  readDone: boolean;
  agreeDone: boolean;
  signDone: boolean;
}) {
  const steps = [
    { label: "Read", done: readDone },
    { label: "Agree", done: agreeDone },
    { label: "Sign", done: signDone },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors",
                step.done
                  ? "border-gold bg-gold-bright text-[#171310]"
                  : "border-border text-muted-foreground",
              )}
            >
              {step.done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                step.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <span className="h-px w-6 shrink-0 bg-border sm:w-10" />
          )}
        </div>
      ))}
    </div>
  );
}

function MouBody({
  document,
  scrollRef,
  onScroll,
  compact = false,
}: {
  document: MouDocument;
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
          {document.title}
        </p>
        {document.preamble.map((p) => (
          <p key={p} className="text-muted-foreground">
            {p}
          </p>
        ))}
      </div>

      {document.clauses.map((clause) => (
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
          {document.declaration.map((line) => (
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
