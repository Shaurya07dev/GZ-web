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

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string | undefined;

  constructor(problem: ProblemDetails) {
    // detail (e.g. the validation issue list) is more actionable than the
    // generic title when present.
    super(problem.detail ?? problem.title);
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
  delete: <T>(url: string, config?: AxiosRequestConfig) => api.delete<T>(url, config).then((r) => r.data),
};
