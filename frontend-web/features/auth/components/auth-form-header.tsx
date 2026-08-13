interface AuthFormHeaderProps {
  title: string;
  description?: string;
}

// Shared heading treatment reused across every Auth screen (Register,
// Login, Forgot/Reset Password, Verify Email) so the five sibling routes
// under app/(auth)/ read as one consistent flow rather than five
// independently-styled pages.
export function AuthFormHeader({ title, description }: AuthFormHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-balance font-display text-2xl font-semibold text-foreground sm:text-[1.75rem]">
        {title}
      </h1>
      {description && (
        <p className="text-balance text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
