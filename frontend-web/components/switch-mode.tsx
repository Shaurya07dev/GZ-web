"use client";

import { useEffect, useState, type FC } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface SwitchModeProps {
  className?: string;
}

export const SwitchMode: FC<SwitchModeProps> = ({ className }) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  if (!mounted) {
    return <div className={cn("size-10", className)} />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
    >
      {isDark ? (
        <Sun className="size-5 text-gold" strokeWidth={1.75} />
      ) : (
        <Moon className="size-5 text-foreground/80" strokeWidth={1.75} />
      )}
    </button>
  );
};
