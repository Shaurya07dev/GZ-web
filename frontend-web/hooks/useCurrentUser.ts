import { useQuery } from "@tanstack/react-query";
import { authService, type CurrentUser } from "@/services/authService";

// The signed-in account from GET /v1/auth/me. Every portal shell, greeting
// and "acted by" label reads from here — never from a fixture identity.
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: () => authService.me(),
    staleTime: 5 * 60_000,
  });
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export type { CurrentUser };
