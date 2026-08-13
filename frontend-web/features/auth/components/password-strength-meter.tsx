import type { CSSProperties } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

// 0-4 strength score from length + character-class checks, no external
// scoring library — this is a UX nudge, not a real entropy calculation.
function scorePassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const checks = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.min(passed, 4) as 0 | 1 | 2 | 3 | 4;
}

// Colored via the brand's gold-scale --chart-1..5 tokens (dimmest to
// brightest) rather than a generic red/yellow/green traffic light, per the
// plan's brand-consistency direction. --primary is overridden locally so
// the shared Progress primitive's `bg-primary` indicator picks up the
// score's color without needing a bespoke variant of that primitive.
const STRENGTH_META: Record<0 | 1 | 2 | 3 | 4, { label: string; color: string }> = {
  0: { label: "", color: "var(--chart-5)" },
  1: { label: "Weak", color: "var(--chart-5)" },
  2: { label: "Fair", color: "var(--chart-3)" },
  3: { label: "Good", color: "var(--chart-2)" },
  4: { label: "Strong", color: "var(--chart-1)" },
};

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const score = scorePassword(password);
  const meta = STRENGTH_META[score];

  if (!password) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Progress
        value={(score / 4) * 100}
        style={{ "--primary": meta.color } as CSSProperties}
        aria-label="Password strength"
      />
      <span className="text-xs text-muted-foreground">
        Password strength: <span className="font-medium text-foreground">{meta.label}</span>
      </span>
    </div>
  );
}
