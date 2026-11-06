// The one HTTP client every services/*.ts file uses to reach the NestJS
// API. Attaches the Firebase ID token, and turns the backend's RFC 7807
// error bodies ({type,title,status,code,detail}) into an ApiError whose
// `message` is human-readable — so the existing `toast(error.message)` /
// `error instanceof Error` handling in hooks and forms keeps working
// unchanged against real responses.

import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { currentIdToken } from "@/lib/firebase";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  [key: string]: unknown;
}

/**
 * Zod validation errors reach us as a `detail` string like
 * "razorpayOrderId: Required; razorpayPaymentId: Required; ...". That is
 * useful in dev tools but unreadable in a user-facing toast — the user
 * asked for that fix after seeing it on the aggregator reserve flow
 * (5 Nov 2026). Collapse any `detail` that looks like a Zod bullet-list
 * into the problem's `title` instead; the title is already written for
 * users.
 */
function isZodValidationChatter(detail: string): boolean {
  // Typical shapes from ZodValidationPipe:
  //   "fieldX: Required"
  //   "fieldX: Required; fieldY: String must contain at least 1 character(s)"
  //   "needs a letter; needs a number"
  return /: (Required|Invalid|Expected|String must|Number must|needs a)/i.test(detail);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;

  constructor(problem: ProblemDetails) {
    // Prefer detail (more actionable) UNLESS it is raw Zod validation
    // chatter — in that case the title is the message users should see.
    const message = problem.detail && !isZodValidationChatter(problem.detail)
      ? problem.detail
      : problem.title;
    super(message);
    this.name = "ApiError";
    this.status = problem.status;
    this.code = problem.code;
    this.detail = problem.detail;
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

export const api = axios.create({ baseURL: API_URL, timeout: 20_000 });

api.interceptors.request.use(async (config) => {
  const token = await currentIdToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      const body = error.response?.data as Partial<ProblemDetails> | undefined;
      if (body && typeof body === "object" && typeof body.code === "string" && typeof body.title === "string") {
        return Promise.reject(new ApiError({ type: body.type ?? "about:blank", status: error.response?.status ?? 0, ...body } as ProblemDetails));
      }
      if (!error.response) {
        return Promise.reject(
          new ApiError({ type: "about:blank", title: `Can't reach the GalleryZone API at ${API_URL}`, status: 0, code: "network_error" }),
        );
      }
    }
    return Promise.reject(error);
  },
);

/** Typed convenience wrappers — services read `.data` directly. */
export const http = {
  get: <T>(url: string, config?: AxiosRequestConfig) => api.get<T>(url, config).then((r) => r.data),
  post: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => api.post<T>(url, body, config).then((r) => r.data),
  patch: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => api.patch<T>(url, body, config).then((r) => r.data),
  put: <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => api.put<T>(url, body, config).then((r) => r.data),
  delete: <T>(url: string, config?: AxiosRequestConfig) => api.delete<T>(url, config).then((r) => r.data),
};
