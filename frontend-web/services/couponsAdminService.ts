import { http } from "@/lib/api";

export interface AdminCoupon {
  code: string;
  kind: "percent" | "flat";
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  validFrom: string;
  validUntil: string;
  usageCap: number | null;
  usedCount: number;
  status: "active" | "paused" | "expired";
  createdBy: string;
  createdAt: string;
}

export interface CreateCouponInput {
  code: string;
  kind: "percent" | "flat";
  value: number;
  minOrderPaise: number | null;
  maxDiscountPaise: number | null;
  validFrom: string;
  validUntil: string;
  usageCap: number | null;
}

export const couponsAdminService = {
  list: async (): Promise<AdminCoupon[]> => {
    const res = await http.get<{ coupons: AdminCoupon[] }>("/v1/admin/coupons");
    return res.coupons;
  },

  create: async (input: CreateCouponInput): Promise<AdminCoupon> => {
    const res = await http.post<{ coupon: AdminCoupon }>("/v1/admin/coupons", input);
    return res.coupon;
  },

  setStatus: async (
    code: string,
    status: "active" | "paused" | "expired",
  ): Promise<AdminCoupon> => {
    const res = await http.patch<{ coupon: AdminCoupon }>(
      `/v1/admin/coupons/${encodeURIComponent(code)}`,
      { status },
    );
    return res.coupon;
  },
};
