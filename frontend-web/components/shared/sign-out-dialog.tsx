"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authService } from "@/services/authService";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A deliberate stop between the sign-out button and the actual sign-out —
// taps on this control have been easy to misfire, both on the account menu
// (one tap on an avatar away from the dashboard) and in the mobile drawer
// (right next to the "My dashboard" link). Shared by the public header and
// every portal's account menu so the two cannot drift on wording or on the
// logout call itself.
//
// authService.logout() clears the session cookie first and only then calls
// Firebase, so landing at /login is correct even if the Firebase call
// fails. A full-page navigation, not router.push, so the next person on
// this browser can't inherit this account's cached queries.
export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleConfirm() {
    setSigningOut(true);
    try {
      await authService.logout();
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!signingOut) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign out of GalleryZone?</DialogTitle>
          <DialogDescription>
            You&rsquo;ll need to sign in again to open your dashboard, see
            your artworks, or make a purchase.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={signingOut}
          >
            Stay signed in
          </Button>
          <Button onClick={handleConfirm} disabled={signingOut}>
            <LogOut className="size-3.5" strokeWidth={2} />
            {signingOut ? "Signing out…" : "Sign out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
