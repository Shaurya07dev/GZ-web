export type HoldingReportIssueType =
  | "damaged_in_transit"
  | "wrong_piece"
  | "quality_issue"
  | "coa_nfc_problem"
  | "missing_accessories"
  | "other";

export type HoldingReportStatus = "open" | "resolved";

export interface HoldingReport {
  id: string;
  holdingId: string;
  artworkId: string;
  artworkTitle: string;
  aggregatorId: string;
  aggregatorName: string;
  aggregatorEmail: string;
  artistId: string;
  artistName: string;
  issueType: HoldingReportIssueType;
  description: string;
  status: HoldingReportStatus;
  reportedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

// Labels for the issue types — shared between the aggregator submit form,
// the admin list, and any future notification copy.
export const ISSUE_TYPE_LABEL: Record<HoldingReportIssueType, string> = {
  damaged_in_transit: "Damaged in transit",
  wrong_piece: "Wrong piece received",
  quality_issue: "Quality issue (not as described)",
  coa_nfc_problem: "COA / NFC tag problem",
  missing_accessories: "Missing accessories",
  other: "Other",
};
