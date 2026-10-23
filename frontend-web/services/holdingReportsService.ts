import { http } from "@/lib/api";
import type { HoldingReport, HoldingReportIssueType, HoldingReportStatus } from "@/types/holding-report";

export interface CreateHoldingReportInput {
  holdingId: string;
  issueType: HoldingReportIssueType;
  description: string;
}

export const holdingReportsService = {
  async create(input: CreateHoldingReportInput): Promise<HoldingReport> {
    return http.post<HoldingReport>(`/v1/aggregator/holdings/${encodeURIComponent(input.holdingId)}/reports`, {
      issueType: input.issueType,
      description: input.description,
    });
  },

  async listForAdmin(status?: HoldingReportStatus): Promise<HoldingReport[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const { reports } = await http.get<{ reports: HoldingReport[] }>(`/v1/admin/holding-reports${query}`);
    return reports;
  },

  async resolve(reportId: string, note?: string): Promise<HoldingReport> {
    return http.post<HoldingReport>(
      `/v1/admin/holding-reports/${encodeURIComponent(reportId)}/resolve`,
      note ? { note } : {},
    );
  },
};
