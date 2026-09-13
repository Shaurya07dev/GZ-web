"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";

// Clears the role cookie proxy.ts guards on AND signs out of Firebase, so
// the next API call carries no token.
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await authService.logout();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      aria-label="Sign out"
      title="Sign out"
      className="rounded-md p-1.5 text-foreground/70 hover:text-foreground"
    >
      <LogOut className="size-4" strokeWidth={1.75} />
    </button>
  );
}
