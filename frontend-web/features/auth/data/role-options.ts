import { Palette, Building2, Compass, type LucideIcon } from "lucide-react";
import type { Role } from "@/features/auth/schemas/auth-schemas";
import { ROLE_LANDING } from "@/lib/session";

export interface RoleOption {
  role: Role;
  label: string;
  description: string;
  icon: LucideIcon;
  redirectPath: string;
}

// Copy sourced from the Onboarding Guide's "Platform Overview" section
// (empowerment + price privacy for artists, physical/digital reach for
// aggregators, verified discovery for buyers) rather than invented —
// exact language given in the plan.
export const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "artist",
    label: "Artist",
    description: "List and sell your original artwork with full price privacy.",
    icon: Palette,
    redirectPath: ROLE_LANDING.artist,
  },
  {
    role: "aggregator",
    label: "Aggregator",
    description:
      "Reserve, display, and distribute verified art through your gallery or space.",
    icon: Building2,
    redirectPath: ROLE_LANDING.aggregator,
  },
  {
    role: "customer",
    label: "Customer",
    description: "Discover and collect verified original artwork.",
    icon: Compass,
    redirectPath: ROLE_LANDING.customer,
  },
];
