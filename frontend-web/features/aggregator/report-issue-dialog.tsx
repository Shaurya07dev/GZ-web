"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Send } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateHoldingReportMutation } from "@/hooks/useHoldingReports";
import { ISSUE_TYPE_LABEL, type HoldingReportIssueType } from "@/types/holding-report";

const ISSUE_TYPES: HoldingReportIssueType[] = [
  "damaged_in_transit",
  "wrong_piece",
  "quality_issue",
  "coa_nfc_problem",
  "missing_accessories",
  "other",
];

interface ReportIssueDialogProps {
  holdingId: string;
  artworkTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportIssueDialog({ holdingId, artworkTitle, open, onOpenChange }: ReportIssueDialogProps) {
  const [issueType, setIssueType] = useState<HoldingReportIssueType | "">("");
  const [description, setDescription] = useState("");
  const createMutation = useCreateHoldingReportMutation();

  function reset() {
    setIssueType("");
    setDescription("");
  }

  function handleSubmit() {
    if (!issueType) {
      toast.error("Pick an issue type");
      return;
    }
    if (description.trim().length < 10) {
      toast.error("Please describe the issue in at least a line or two");
      return;
    }
    createMutation.mutate(
      { holdingId, issueType, description: description.trim() },
      {
        onSuccess: () => {
          toast.success("Report sent to GalleryZone", {
            description: "An admin will review and get back to you.",
          });
          reset();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message || "Could not send the report"),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (createMutation.isPending) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-400" />
            Report an issue
          </DialogTitle>
          <DialogDescription>
            Flag a problem with &ldquo;{artworkTitle}&rdquo; so GalleryZone can
            look into it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="issue-type">Issue type</Label>
            <Select
              value={issueType}
              onValueChange={(value) => setIssueType(value as HoldingReportIssueType)}
              disabled={createMutation.isPending}
            >
              <SelectTrigger id="issue-type">
                <SelectValue placeholder="Pick what went wrong" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ISSUE_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Describe what&apos;s wrong</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you receive, and what's off about it? The more detail, the faster an admin can act."
              rows={5}
              maxLength={2000}
              disabled={createMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/2000 characters
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            <Send className="size-3.5" strokeWidth={2} />
            {createMutation.isPending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
