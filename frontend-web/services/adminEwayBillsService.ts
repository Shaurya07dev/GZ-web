// Admin API for the e-way bill audit log + cancel/extend actions.
// Backed by backend/apps/api/src/admin-eway-bills.controller.ts
// (routes /v1/admin/eway-bills).

import { http } from "@/lib/api";

export type EwayBillAction =
  | "generate"
  | "cancel"
  | "extend"
  | "update_transporter"
  | "get";

export type EwayBillSubject =
  | { kind: "order_shipment"; orderId: string }
  | { kind: "holding_inbound"; holdingId: string }
  | { kind: "holding_return"; holdingId: string };

export interface EwayBillEventView {
  id: string;
  endpoint: string;
  action: EwayBillAction;
  subject: EwayBillSubject;
  requestAt: string;
  initiatedBy: string | null;
  httpStatus: number;
  statusCd: string | null;
  ewbNo: string | null;
  generatedAt: string | null;
  validUntil: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  responseSnippet: string;
}

export interface EwayBillListResponse {
  enabled: boolean;
  disabledReason: string | null;
  events: EwayBillEventView[];
}

export interface CancelEwayBillInput {
  ewbNo: string;
  // NIC: 1 = Duplicate, 2 = Order cancelled, 3 = Data entry mistake, 4 = Others.
  reasonCode: 1 | 2 | 3 | 4;
  remarks: string;
}

export interface ExtendEwayBillInput {
  ewbNo: string;
  reasonCode: number;
  remarks: string;
  remainingDistanceKm: number;
  // "1" = In movement, "2" = In transit (parked).
  consignmentStatus: "1" | "2";
  from: { place: string; pincode: number; stateCode: string };
}

export const adminEwayBillsService = {
  list: (): Promise<EwayBillListResponse> =>
    http.get<EwayBillListResponse>("/v1/admin/eway-bills"),

  cancel: (input: CancelEwayBillInput): Promise<{ ok: true }> =>
    http.post<{ ok: true }>(
      `/v1/admin/eway-bills/${encodeURIComponent(input.ewbNo)}/cancel`,
      { reasonCode: input.reasonCode, remarks: input.remarks },
    ),

  extend: (input: ExtendEwayBillInput): Promise<{ ewbNo: string; generatedAt: string; validUntil: string }> =>
    http.post<{ ewbNo: string; generatedAt: string; validUntil: string }>(
      `/v1/admin/eway-bills/${encodeURIComponent(input.ewbNo)}/extend`,
      {
        reasonCode: input.reasonCode,
        remarks: input.remarks,
        remainingDistanceKm: input.remainingDistanceKm,
        consignmentStatus: input.consignmentStatus,
        from: input.from,
      },
    ),
};
