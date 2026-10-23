"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAdminHoldingReports,
  useResolveHoldingReportMutation,
} from "@/hooks/useHoldingReports";
import {
  ISSUE_TYPE_LABEL,
  type HoldingReport,
  type HoldingReportStatus,
} from "@/types/holding-report";

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(new Date(iso));
}

const TABS: { value: HoldingReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export function AdminHoldingReportsBoard() {
  const [tab, setTab] = useState<HoldingReportStatus>("open");
  const { data: reports, isPending } = useAdminHoldingReports(tab);
  const [resolving, setResolving] = useState<HoldingReport | null>(null);

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as HoldingReportStatus)}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground data-active:border-gold/50 data-active:bg-gold/10 data-active:text-gold-bright after:hidden"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-6">
        {isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : !reports || reports.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title={tab === "open" ? "No open reports" : "No resolved reports yet"}
            description={
              tab === "open"
                ? "Aggregators report issues from the holding detail page. New ones show up here."
                : "Resolved reports move here once an admin marks them handled."
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onResolve={() => setResolving(report)}
              />
            ))}
          </div>
        )}
      </div>

      {resolving && (
        <ResolveDialog
          report={resolving}
          onClose={() => setResolving(null)}
        />
      )}
    </>
  );
}

function ReportCard({
  report,
  onResolve,
}: {
  report: HoldingReport;
  onResolve: () => void;
}) {
  const isOpen = report.status === "open";
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                isOpen
                  ? "border-amber-500/40 text-amber-300"
                  : "border-emerald-500/40 text-emerald-300"
              }`}
            >
              <AlertTriangle className="size-3" strokeWidth={2} />
              {ISSUE_TYPE_LABEL[report.issueType]}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(report.reportedAt)}
            </span>
          </div>
          <p className="mt-2 font-display text-sm font-semibold text-foreground">
            {report.artworkTitle}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            By {report.artistName} · Reserved by {report.aggregatorName} ({report.aggregatorEmail})
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/admin/catalog/artwork/${report.artworkId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ExternalLink className="size-3" />
            Open artwork
          </Link>
          {isOpen && (
            <Button size="sm" onClick={onResolve}>
              <Check className="size-3.5" strokeWidth={2} />
              Mark resolved
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/60 bg-background/50 p-3">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Description
        </p>
        <p className="mt-1 text-sm whitespace-pre-line text-foreground">{report.description}</p>
      </div>

      {report.status === "resolved" && report.resolutionNote && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
          <p className="text-[11px] font-medium tracking-wide text-emerald-300 uppercase">
            Resolution note · {formatDateTime(report.resolvedAt)}
          </p>
          <p className="mt-1 text-sm whitespace-pre-line text-foreground">{report.resolutionNote}</p>
        </div>
      )}
    </article>
  );
}

function ResolveDialog({
  report,
  onClose,
}: {
  report: HoldingReport;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const resolveMutation = useResolveHoldingReportMutation();

  function handleConfirm() {
    resolveMutation.mutate(
      { reportId: report.id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Report marked resolved");
          onClose();
        },
        onError: (err) => toast.error(err.message || "Could not resolve the report"),
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (resolveMutation.isPending) return;
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark this report resolved?</DialogTitle>
          <DialogDescription>
            Optional note — the aggregator will be able to see it. &ldquo;{report.artworkTitle}&rdquo;
            will move from Open to Resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resolve-note">Resolution note (optional)</Label>
          <Textarea
            id="resolve-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How was this handled? Refund issued, piece replaced, aggregator contacted…"
            rows={4}
            maxLength={1000}
            disabled={resolveMutation.isPending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={resolveMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={resolveMutation.isPending}>
            <Check className="size-3.5" strokeWidth={2} />
            {resolveMutation.isPending ? "Resolving…" : "Mark resolved"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
