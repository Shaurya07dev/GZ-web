"use client";

import { useState, type FormEvent } from "react";
import { Copy, Check, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInitiateTransferMutation } from "@/hooks/useOwnershipTransfers";

// Used by whoever currently owns the piece — the artist after a first sale,
// or a collector reselling it later. Same dialog both times, because it is the
// same hand-over: name the next owner, they accept, the passport updates.
export function TransferRightsDialog({
  open,
  onOpenChange,
  artworkId,
  artworkTitle,
  fromName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  artworkTitle: string;
  fromName: string;
}) {
  const initiateMutation = useInitiateTransferMutation();
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    initiateMutation.mutate(
      { artworkId, fromName, toName, toEmail },
      {
        onSuccess: (transfer) => {
          setLink(
            `${window.location.origin}/transfer/${transfer.id}`,
          );
        },
      },
    );
  }

  function handleClose(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setToName("");
      setToEmail("");
      setLink(null);
      setCopied(false);
      initiateMutation.reset();
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            Hand the digital ownership record for &ldquo;{artworkTitle}&rdquo;
            to its new owner.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-gold/30 bg-gold/5 p-4">
              <p className="text-sm font-medium text-foreground">
                Transfer created for {toName}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Ownership does not change until they accept. Send them this
                link — email delivery isn&rsquo;t wired up in this demo, so
                share it directly for now.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="transferLink">Transfer link</Label>
              <div className="flex gap-2">
                <Input
                  id="transferLink"
                  readOnly
                  value={link}
                  className="h-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold-bright"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleClose(false)}
              className="self-start rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="toName">New owner&rsquo;s name</Label>
              <Input
                id="toName"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="Rhea Menon"
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="toEmail">New owner&rsquo;s email</Label>
              <Input
                id="toEmail"
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="rhea@example.com"
                className="h-10"
              />
              <p className="text-xs text-muted-foreground">
                They receive a link and have to accept before the ownership
                record changes.
              </p>
            </div>

            {initiateMutation.isError && (
              <p className="text-sm text-destructive">
                {initiateMutation.error instanceof Error
                  ? initiateMutation.error.message
                  : "Something went wrong."}
              </p>
            )}

            <button
              type="submit"
              disabled={
                !toName.trim() || !toEmail.trim() || initiateMutation.isPending
              }
              className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-40"
            >
              <Send className="size-3.5" />
              Create transfer
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
