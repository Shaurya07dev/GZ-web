import type { LucideIcon } from "lucide-react";

interface AuthFormHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

// Shared heading treatment reused across every Auth screen (Register,
// Login, Forgot/Reset Password, Verify Email) so the five sibling routes
// under app/(auth)/ read as one consistent flow rather than five
// independently-styled pages.
export function AuthFormHeader({
  title,
  description,
  icon: Icon,
}: AuthFormHeaderProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold/25 via-gold/10 to-transparent shadow-[0_0_24px_-6px_var(--gold)] ring-1 ring-gold/30">
            <Icon className="size-5 text-gold-bright" strokeWidth={1.75} />
          </span>
        )}
        <h1 className="text-balance font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          {title}
        </h1>
      </div>
      {description && (
        <p className="text-balance text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
