import { redirect } from "next/navigation";

// The old standalone "coming soon" stub lived here before the AccountShell
// (features/account/account-shell.tsx) existed. Now that Orders/Wishlist/
// Addresses/Settings are real pages under the shell, there's no need for a
// distinct "/account" overview separate from Orders -- redirecting is
// simpler than building and maintaining a landing page nobody needs.
export default function AccountPage() {
  redirect("/account/orders");
}
