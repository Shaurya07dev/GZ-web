"use client";

import { useState, type FormEvent } from "react";
import { Mail, Megaphone } from "lucide-react";
import { ConfirmActionDialog } from "@/features/admin/confirm-action-dialog";
import { AdminDataTable, type AdminDataTableColumn } from "@/features/admin/admin-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBroadcastReach, useBroadcasts, useSendBroadcastMutation } from "@/hooks/useAdminBroadcasts";
import { cn } from "@/lib/utils";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_TITLE_MAX,
  type Broadcast,
  type BroadcastAudience,
} from "@/services/broadcastService";

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = { artist: "Artists", aggregator: "Aggregators" };
const AUDIENCES: BroadcastAudience[] = ["artist", "aggregator"];

const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const audienceText = (audiences: string[]) =>
  audiences.length === AUDIENCES.length ? "Artists and aggregators" : audiences.map((a) => AUDIENCE_LABEL[a as BroadcastAudience] ?? a).join(", ");

// A page on this site only, which is also what the server accepts.
const SITE_PATH = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/;

export function BroadcastView() {
  const [audiences, setAudiences] = useState<BroadcastAudience[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [confirming, setConfirming] = useState(false);

  const { data: reach } = useBroadcastReach();
  const { data: sent, isPending } = useBroadcasts();
  const send = useSendBroadcastMutation();

  const people = audiences.reduce((sum, a) => sum + (reach?.[a] ?? 0), 0);
  const urlInvalid = url.trim() !== "" && !SITE_PATH.test(url.trim());
  const ready = audiences.length > 0 && title.trim() !== "" && body.trim() !== "" && !urlInvalid;

  function toggle(audience: BroadcastAudience) {
    setAudiences((current) => (current.includes(audience) ? current.filter((a) => a !== audience) : [...current, audience]));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ready) setConfirming(true);
  }

  async function confirmSend() {
    try {
      await send.mutateAsync({ audiences, title: title.trim(), body: body.trim(), url: url.trim() || null });
    } catch {
      // The toast already says why. The box stays open so the message is not lost and can be sent again.
      return;
    }
    // Close first: the box reads the form, so clearing the form under it would show "Send to 0 people?".
    setConfirming(false);
    setTitle("");
    setBody("");
    setUrl("");
    setAudiences([]);
  }

  const columns: AdminDataTableColumn<Broadcast>[] = [
    {
      key: "sentAt",
      header: "Sent",
      render: (row) => <span className="text-sm whitespace-nowrap text-muted-foreground">{dateTime.format(new Date(row.sentAt))}</span>,
      sortable: true,
      sortValue: (row) => row.sentAt,
    },
    {
      key: "message",
      header: "Message",
      render: (row) => (
        <div className="min-w-0 max-w-md">
          <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{row.body}</p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.title,
    },
    {
      key: "to",
      header: "To",
      render: (row) => <span className="text-sm text-foreground">{audienceText(row.audiences)}</span>,
    },
    {
      key: "people",
      header: "People",
      render: (row) => <span className="text-sm tabular-nums text-foreground">{row.recipientCount}</span>,
      sortable: true,
      sortValue: (row) => row.recipientCount,
      className: "text-right",
    },
    {
      key: "by",
      header: "Sent by",
      render: (row) => <span className="text-sm text-muted-foreground">{row.sentByName}</span>,
      sortable: true,
      sortValue: (row) => row.sentByName,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-lg border border-border bg-card p-5 sm:p-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-foreground">Send to</legend>
            <div className="flex flex-wrap gap-3">
              {AUDIENCES.map((audience) => {
                const checked = audiences.includes(audience);
                return (
                  <label
                    key={audience}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition-colors",
                      checked ? "border-gold bg-gold/10 text-foreground" : "border-border text-foreground/85 hover:border-gold/40",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(audience)} />
                    <span className="font-medium">{AUDIENCE_LABEL[audience]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{reach ? reach[audience] : "…"}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {audiences.length === 0
                ? "Tick one or both. Suspended and blocked accounts are skipped."
                : `Reaches ${people} ${people === 1 ? "person" : "people"}.`}
            </p>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input
              id="broadcast-title"
              className="h-10"
              maxLength={BROADCAST_TITLE_MAX}
              placeholder="What this is about, in a few words"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-body">Message</Label>
            <Textarea
              id="broadcast-body"
              className="min-h-32"
              maxLength={BROADCAST_BODY_MAX}
              placeholder="Type the message everyone will get"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-right text-xs text-muted-foreground tabular-nums">
              {body.length} / {BROADCAST_BODY_MAX}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="broadcast-url">
              Page to open <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="broadcast-url"
              className="h-10 sm:max-w-sm"
              placeholder="/dashboard/coa-nfc"
              value={url}
              aria-invalid={urlInvalid}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className={cn("text-xs", urlInvalid ? "text-destructive" : "text-muted-foreground")}>
              {urlInvalid ? "Use a page on this site, starting with a single /." : "The bell notification opens this page. Left empty, it opens their Messages."}
            </p>
          </div>

          <div>
            <Button type="submit" disabled={!ready || send.isPending}>
              <Megaphone className="size-4" />
              Review and send
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">How it will look</p>
          <div className="rounded-lg border border-border bg-card/70">
            <div className="flex items-start gap-3 px-4 py-3.5">
              <Mail className="mt-0.5 size-4 shrink-0 text-gold-bright" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">GalleryZone</p>
                <p className="mt-0.5 text-sm font-medium break-words text-foreground">{title.trim() || "Your title"}</p>
                <p className="mt-1 text-sm break-words whitespace-pre-line text-muted-foreground">{body.trim() || "Your message appears here."}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">Just now</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            In their Messages inbox, with a bell notification. A message cannot be taken back once it is sent.
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">Sent so far</h2>
        <AdminDataTable
          rows={sent ?? []}
          columns={columns}
          isLoading={isPending}
          getRowKey={(row) => row.id}
          searchPlaceholder="Search sent messages"
          searchValue={(row) => `${row.title} ${row.body} ${row.sentByName}`}
          emptyTitle="Nothing sent yet"
          emptyDescription="Messages you send will be listed here."
        />
      </section>

      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Send to ${people} ${people === 1 ? "person" : "people"}?`}
        description={
          <>
            <strong>{audienceText(audiences)}</strong> will get &ldquo;{title.trim()}&rdquo; in their Messages. This cannot be undone.
          </>
        }
        confirmLabel="Send message"
        isPending={send.isPending}
        onConfirm={confirmSend}
      />
    </div>
  );
}
