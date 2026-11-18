"use client";

import { useState } from "react";
import { Check, Inbox, RotateCcw } from "lucide-react";
import { AdminDataTable, type AdminDataTableColumn } from "@/features/admin/admin-data-table";
import { Button } from "@/components/ui/button";
import { useAdminEnquiries, useSetEnquiryStatusMutation } from "@/hooks/useEnquiries";
import { cn } from "@/lib/utils";
import { ENQUIRY_TYPES, ENQUIRY_TYPE_LABEL, type Enquiry, type EnquiryStatus, type EnquiryType } from "@/services/enquiryService";

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const ROLE_LABEL: Record<string, string> = { artist: "Artist", aggregator: "Gallery / Aggregator", collector: "Collector" };

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "border-transparent bg-gold text-[#171310]" : "border-border text-foreground/80 hover:border-gold/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// Every "Get in touch" message, newest first. Filter by what it is about, and by whether it is still waiting.
export function EnquiriesView() {
  const [type, setType] = useState<EnquiryType | null>(null);
  const [status, setStatus] = useState<EnquiryStatus | null>("new");
  const { data, isPending, isError, refetch } = useAdminEnquiries({ type, status });
  const setStatusMutation = useSetEnquiryStatusMutation();

  const waiting = data?.waiting;
  const totalWaiting = waiting ? Object.values(waiting).reduce((a, b) => a + b, 0) : 0;

  const columns: AdminDataTableColumn<Enquiry>[] = [
    {
      key: "createdAt",
      header: "Received",
      render: (row) => <span className="text-sm whitespace-nowrap text-muted-foreground">{dateTime.format(new Date(row.createdAt))}</span>,
      sortable: true,
      sortValue: (row) => row.createdAt,
    },
    {
      key: "type",
      header: "About",
      render: (row) => (
        <span className="inline-flex rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-xs font-medium text-gold-bright">
          {ENQUIRY_TYPE_LABEL[row.type]}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.type,
    },
    {
      key: "from",
      header: "From",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <a href={`mailto:${row.email}`} className="truncate text-xs text-gold-bright hover:underline">
            {row.email}
          </a>
          <p className="text-xs text-muted-foreground">{ROLE_LABEL[row.senderRole] ?? row.senderRole}</p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "message",
      header: "Message",
      render: (row) => <p className="max-w-lg text-sm whitespace-pre-line text-foreground">{row.message}</p>,
    },
    {
      key: "status",
      header: "",
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          disabled={setStatusMutation.isPending}
          onClick={() => setStatusMutation.mutate({ id: row.id, status: row.status === "new" ? "handled" : "new" })}
        >
          {row.status === "new" ? (
            <>
              <Check className="size-3.5" /> Mark handled
            </>
          ) : (
            <>
              <RotateCcw className="size-3.5" /> Reopen
            </>
          )}
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by what the message is about">
          <Chip active={type === null} onClick={() => setType(null)}>
            All types
          </Chip>
          {ENQUIRY_TYPES.map((option) => (
            <Chip key={option.value} active={type === option.value} onClick={() => setType(type === option.value ? null : option.value)}>
              {option.label}
              {waiting && waiting[option.value] > 0 && (
                <span className={cn("text-xs tabular-nums", type === option.value ? "text-[#171310]/70" : "text-gold-bright")}>{waiting[option.value]}</span>
              )}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
          <Chip active={status === "new"} onClick={() => setStatus("new")}>
            Waiting {totalWaiting > 0 && <span className="text-xs tabular-nums">{totalWaiting}</span>}
          </Chip>
          <Chip active={status === "handled"} onClick={() => setStatus("handled")}>
            Handled
          </Chip>
          <Chip active={status === null} onClick={() => setStatus(null)}>
            Everything
          </Chip>
        </div>
      </div>

      {isError ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Couldn&apos;t load the messages.{" "}
          <button type="button" onClick={() => refetch()} className="text-gold-bright hover:underline">
            Try again
          </button>
        </div>
      ) : (
        <AdminDataTable
          columns={columns}
          rows={data?.enquiries ?? []}
          getRowKey={(row) => row.id}
          isLoading={isPending}
          searchPlaceholder="Search name, email or message"
          searchValue={(row) => `${row.name} ${row.email} ${row.message}`}
          emptyIcon={Inbox}
          emptyTitle={status === "new" ? "Nothing waiting" : "No messages here"}
          emptyDescription="Messages from the Get in touch form appear here as they arrive."
        />
      )}
    </div>
  );
}
