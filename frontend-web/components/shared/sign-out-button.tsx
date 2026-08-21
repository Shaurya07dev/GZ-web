"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/session";

// Clears the fake session cookie login-form.tsx writes and sends proxy.ts
// back to treating every guarded route as signed-out.
export function SignOutButton() {
  const router = useRouter();

  function handleSignOut() {
    signOut();
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
