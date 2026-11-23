"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, FileText } from "lucide-react";
import {
  AdminDataTable,
  type AdminDataTableColumn,
} from "@/features/admin/admin-data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminEwayBills,
  useCancelEwayBillMutation,
} from "@/hooks/useAdminEwayBills";
import type {
  EwayBillEventView,
  EwayBillSubject,
} from "@/services/adminEwayBillsService";

const ACTIONS = ["generate", "cancel", "extend", "update_transporter", "get"] as const;
type Action = (typeof ACTIONS)[number];

function describeSubject(s: EwayBillSubject): string {
  switch (s.kind) {
    case "order_shipment":
      return `Order ${s.orderId}`;
    case "holding_inbound":
      return `Holding inbound · ${s.holdingId}`;
    case "holding_return":
      return `Holding return · ${s.holdingId}`;
  }
}

function statusLabel(e: EwayBillEventView): "Success" | "Failed" {
  return e.statusCd === "1" && !e.errorCode ? "Success" : "Failed";
}

export function EwayBillsTable() {
  const { data, isPending } = useAdminEwayBills();
  const [active, setActive] = useState<EwayBillEventView | null>(null);

  const columns: AdminDataTableColumn<EwayBillEventView>[] = [
    {
      key: "requestAt",
      header: "When",
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.requestAt).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
      sortable: true,
      sortValue: (row) => -new Date(row.requestAt).getTime(),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <span className="text-sm font-medium text-foreground">{row.action}</span>
      ),
      sortable: true,
      sortValue: (row) => row.action,
    },
    {
      key: "subject",
      header: "Subject",
      render: (row) => (
        <span className="text-sm text-foreground">{describeSubject(row.subject)}</span>
      ),
    },
    {
      key: "ewbNo",
      header: "EWB No.",
      render: (row) =>
        row.ewbNo ? (
          <span className="font-mono text-sm text-foreground">{row.ewbNo}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const ok = statusLabel(row) === "Success";
        return (
          <span
            className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${
              ok
                ? "bg-emerald-50 text-emerald-700"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {ok ? "Success" : "Failed"}
          </span>
        );
      },
      sortable: true,
      sortValue: (row) => statusLabel(row),
    },
  ];

  return (
    <>
      {data && !data.enabled && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">E-way bill service is not configured.</p>
            <p className="mt-0.5 text-xs leading-relaxed">
              {data.disabledReason ??
                "Set the EWAYBILL_* environment variables on the API service to enable generation. Shipments will continue to book, but without an e-way bill number."}
            </p>
          </div>
        </div>
      )}

      <AdminDataTable
        rows={data?.events ?? []}
        columns={columns}
        isLoading={isPending}
        getRowKey={(row) => row.id}
        onRowClick={(row) => setActive(row)}
        getRowLabel={(row) => `Open event ${row.id}`}
        searchPlaceholder="Search by EWB number, subject, or error code"
        searchValue={(row) =>
          `${row.ewbNo ?? ""} ${describeSubject(row.subject)} ${row.errorCode ?? ""} ${row.errorMessage ?? ""}`
        }
        filters={[
          {
            key: "action",
            label: "Action",
            options: ACTIONS.map((a) => ({ value: a, label: a })),
            matches: (row, value) => row.action === (value as Action),
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "Success", label: "Success" },
              { value: "Failed", label: "Failed" },
            ],
            matches: (row, value) => statusLabel(row) === value,
          },
        ]}
        emptyTitle="No e-way bill events yet"
        emptyDescription="Every API attempt — success or failure — shows up here newest first."
        emptyIcon={FileText}
      />

      <EventDetailDialog
        event={active}
        onClose={() => setActive(null)}
      />
    </>
  );
}

function EventDetailDialog({
  event,
  onClose,
}: {
  event: EwayBillEventView | null;
  onClose: () => void;
}) {
  const [cancelReason, setCancelReason] = useState<1 | 2 | 3 | 4>(3);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const cancel = useCancelEwayBillMutation();

  if (!event) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    );
  }

  const ok = statusLabel(event) === "Success";
  const canCancel = ok && event.ewbNo && event.action === "generate";

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {event.action === "generate" && ok
              ? `E-way bill ${event.ewbNo}`
              : `${event.action} — ${describeSubject(event.subject)}`}
          </DialogTitle>
        </DialogHeader>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Subject</dt>
            <dd className="text-foreground">{describeSubject(event.subject)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Endpoint</dt>
            <dd className="font-mono text-foreground">{event.endpoint}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Requested at</dt>
            <dd className="text-foreground">
              {new Date(event.requestAt).toLocaleString("en-IN")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">HTTP / NIC</dt>
            <dd className="text-foreground">
              {event.httpStatus} · status_cd={event.statusCd ?? "—"}
            </dd>
          </div>
          {event.ewbNo && (
            <div>
              <dt className="text-xs text-muted-foreground">E-way bill no.</dt>
              <dd className="font-mono text-foreground">{event.ewbNo}</dd>
            </div>
          )}
          {event.validUntil && (
            <div>
              <dt className="text-xs text-muted-foreground">Valid until</dt>
              <dd className="text-foreground">{event.validUntil}</dd>
            </div>
          )}
          {event.errorCode && (
            <div className="col-span-2 rounded-sm bg-destructive/10 p-2 text-destructive">
              <dt className="text-xs font-medium">
                {event.errorCode}
              </dt>
              <dd className="text-sm">{event.errorMessage}</dd>
            </div>
          )}
        </dl>

        {event.responseSnippet && (
          <details className="mt-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Raw NIC response
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
              {event.responseSnippet}
            </pre>
          </details>
        )}

        {canCancel && (
          <div className="mt-4 rounded-md border border-border/80 bg-background p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Ban className="size-4" aria-hidden /> Cancel this bill
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              NIC accepts cancellation within 24 hours of generation. Pick a
              reason and add a remark explaining why.
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <Label htmlFor="cancel-reason">Reason</Label>
                <select
                  id="cancel-reason"
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={cancelReason}
                  onChange={(e) =>
                    setCancelReason(Number(e.target.value) as 1 | 2 | 3 | 4)
                  }
                >
                  <option value={1}>1 — Duplicate</option>
                  <option value={2}>2 — Order cancelled</option>
                  <option value={3}>3 — Data entry mistake</option>
                  <option value={4}>4 — Others</option>
                </select>
              </div>
              <div>
                <Label htmlFor="cancel-remarks">Remarks</Label>
                <Textarea
                  id="cancel-remarks"
                  placeholder="e.g. Buyer cancelled order within 10 minutes of booking"
                  value={cancelRemarks}
                  onChange={(e) => setCancelRemarks(e.target.value)}
                  maxLength={100}
                  rows={2}
                />
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {cancelRemarks.length}/100
                </p>
              </div>
              <Button
                disabled={cancel.isPending || cancelRemarks.trim().length < 3}
                onClick={() =>
                  cancel.mutate(
                    {
                      ewbNo: event.ewbNo!,
                      reasonCode: cancelReason,
                      remarks: cancelRemarks.trim(),
                    },
                    {
                      onSuccess: () => {
                        toast.success(`E-way bill ${event.ewbNo} cancelled`);
                        onClose();
                      },
                      onError: (err) => toast.error((err as Error).message),
                    },
                  )
                }
              >
                {cancel.isPending ? "Cancelling…" : "Cancel e-way bill"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
