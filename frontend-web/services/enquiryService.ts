import { http } from "@/lib/api";

// The one "Get in touch" form (backend: enquiries.controller.ts) and the admin's inbox for it.

export type EnquiryType = "advertisement" | "collaboration" | "general" | "support";
export type EnquiryStatus = "new" | "handled";

/** What a message can be about, in the order the form offers them (client, 18 Nov 2026). */
export const ENQUIRY_TYPES: { value: EnquiryType; label: string; hint: string }[] = [
  { value: "general", label: "General question", hint: "Anything about GalleryZone" },
  { value: "support", label: "Support", hint: "Help with your account, an order or a listing" },
  { value: "advertisement", label: "Advertisement", hint: "Put your brand in front of art lovers" },
  { value: "collaboration", label: "Collaboration", hint: "Partner with GalleryZone" },
];

export const ENQUIRY_TYPE_LABEL = Object.fromEntries(ENQUIRY_TYPES.map((t) => [t.value, t.label])) as Record<EnquiryType, string>;

/** A page can send a visitor to the form with the type already chosen: /contact?type=advertisement. */
export function enquiryTypeFrom(value: string | null | undefined): EnquiryType | null {
  return ENQUIRY_TYPES.some((t) => t.value === value) ? (value as EnquiryType) : null;
}

export const ENQUIRY_MESSAGE_MAX = 2000;

export interface NewEnquiry {
  type: EnquiryType;
  name: string;
  email: string;
  senderRole: "artist" | "aggregator" | "collector";
  message: string;
  /** A hidden field real people never fill in. */
  website?: string;
}

export interface Enquiry {
  id: string;
  type: EnquiryType;
  name: string;
  email: string;
  senderRole: string;
  message: string;
  status: EnquiryStatus;
  createdAt: string;
  handledAt: string | null;
}

export interface EnquiryList {
  enquiries: Enquiry[];
  /** How many of each type are still new. */
  waiting: Record<EnquiryType, number>;
}

export const enquiryService = {
  submit: (input: NewEnquiry) => http.post<{ id: string }>("/v1/contact", input),

  list: (filter: { type?: EnquiryType | null; status?: EnquiryStatus | null } = {}) => {
    const params = new URLSearchParams();
    if (filter.type) params.set("type", filter.type);
    if (filter.status) params.set("status", filter.status);
    const query = params.toString();
    return http.get<EnquiryList>(`/v1/admin/enquiries${query ? `?${query}` : ""}`);
  },

  setStatus: (id: string, status: EnquiryStatus) => http.patch<{ id: string; status: EnquiryStatus }>(`/v1/admin/enquiries/${encodeURIComponent(id)}`, { status }),
};
