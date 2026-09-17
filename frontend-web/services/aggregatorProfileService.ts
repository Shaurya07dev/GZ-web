// The aggregator's own profile on the API (GET/PATCH /v1/me/profile) plus
// the partner MOU record (GET/POST /v1/aggregator/mou). An acceptance of
// an older MOU version reads as unsigned, which forces a re-sign.

import { http } from "@/lib/api";
import { profileApi, type OwnProfileDto, type OwnProfilePatch } from "@/services/profileApi";
import { AGGREGATOR_MOU_VERSION } from "@/features/aggregator/aggregator-mou-data";

export interface AggregatorProfileView {
  companyName: string;
  contactPerson: string;
  avatar: string | null;
  gstNumber: string;
  phone: string;
  email: string;
  country: string;
  addressLine1: string;
  bankAccountMasked: string;
  /** Write-only: never returned by the API. */
  bankAccountNumber?: string;
  ifsc: string;
  securityDepositStatus: "active" | "pending";
  aadhaarMasked: string | null;
  coordinatorDesignation: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  mouAcceptance: { acceptedAt: string; signatureName: string; version: string; signatureDataUrl: string | null } | null;
}

interface MouDto {
  party: "artist" | "aggregator";
  version: string;
  signatureName: string;
  signatureDataUrl: string | null;
  acceptedAt: string;
}

function toView(p: OwnProfileDto, mou: MouDto | null): AggregatorProfileView {
  return {
    companyName: p.companyName ?? p.fullName,
    contactPerson: p.fullName,
    avatar: p.profileImageUrl,
    gstNumber: p.gstin ?? "",
    phone: p.phone ?? "",
    email: p.email,
    country: "IN",
    addressLine1: [p.pickupLine1, p.pickupLine2, p.pickupCity, p.pickupState, p.pickupPincode].filter(Boolean).join(", "),
    bankAccountMasked: p.bankAccountMasked ?? "",
    ifsc: p.ifsc ?? "",
    securityDepositStatus: "pending",
    aadhaarMasked: p.aadhaarMasked,
    coordinatorDesignation: p.headline ?? "",
    coordinatorPhone: p.phone ?? "",
    coordinatorEmail: p.email,
    mouAcceptance: mou && mou.version === AGGREGATOR_MOU_VERSION ? { acceptedAt: mou.acceptedAt, signatureName: mou.signatureName, version: mou.version, signatureDataUrl: mou.signatureDataUrl } : null,
  };
}

async function mou(): Promise<MouDto | null> {
  return (await http.get<{ acceptance: MouDto | null }>("/v1/aggregator/mou")).acceptance;
}

export const aggregatorProfileService = {
  getProfile: async (): Promise<AggregatorProfileView> => {
    const [p, m] = await Promise.all([profileApi.get(), mou()]);
    return toView(p, m);
  },

  acceptMou: async (input: { signatureName: string; version: string; signatureDataUrl?: string | null }): Promise<AggregatorProfileView> => {
    if (!input.signatureName.trim()) throw new Error("Type your full name to sign");
    const accepted = await http.post<MouDto>("/v1/aggregator/mou/accept", {
      version: input.version,
      signatureName: input.signatureName.trim(),
      signatureDataUrl: input.signatureDataUrl ?? null,
    });
    return toView(await profileApi.get(), accepted);
  },

  updateProfile: async (patch: Partial<AggregatorProfileView>): Promise<AggregatorProfileView> => {
    const body: OwnProfilePatch = {};
    if (patch.contactPerson !== undefined) body.fullName = patch.contactPerson;
    if (patch.companyName !== undefined) body.companyName = patch.companyName || null;
    if (patch.phone !== undefined) body.phone = patch.phone || null;
    if (patch.gstNumber !== undefined) body.gstin = patch.gstNumber || null;
    if (patch.addressLine1 !== undefined) body.pickupLine1 = patch.addressLine1 || null;
    if (patch.ifsc !== undefined) body.ifsc = patch.ifsc || null;
    if (patch.bankAccountNumber !== undefined) body.bankAccountNumber = patch.bankAccountNumber || null;
    if (patch.coordinatorDesignation !== undefined) body.headline = patch.coordinatorDesignation || null;
    const p = await profileApi.update(body);
    return toView(p, await mou());
  },
};
