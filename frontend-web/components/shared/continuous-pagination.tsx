"use client";

import { type FC, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTheme } from "next-themes";

export interface ContinuousPaginationProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

interface PageButtonProps {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

const PageButton: FC<PageButtonProps> = ({ children, disabled, onClick }) => {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground border-border bg-background flex h-10 w-10 items-center justify-center rounded-lg border shadow-[0_4px_10px_hsl(var(--foreground)/0.1)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-16 sm:w-16"
      whileHover={
        disabled
          ? {}
          : {
              scale: 1.08,
              y: -6,
              boxShadow: "0 6px 10px hsl(var(--foreground)/0.12)",
            }
      }
      whileTap={disabled ? {} : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {children}
    </motion.button>
  );
};

export const ContinuousPagination: FC<ContinuousPaginationProps> = ({
  page,
  pageCount,
  onPage,
}) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (pageCount <= 1) return null;

  const paginate = (next: number) => {
    if (next < 1 || next > pageCount) return;
    onPage(next);
  };

  return (
    <nav
      aria-label="Marketplace pages"
      className="mt-8 flex items-center justify-center gap-1.5 text-sm sm:gap-3"
    >
      <PageButton disabled={page <= 1} onClick={() => paginate(page - 1)}>
        <ChevronLeft className="h-5 w-5 sm:h-7 sm:w-7" />
      </PageButton>

      <div className="relative flex gap-1.5 sm:gap-3">
        {Array.from({ length: pageCount }).map((_, i) => {
          const n = i + 1;
          const isActive = n === page;

          return (
            <motion.button
              key={n}
              type="button"
              aria-current={isActive ? "page" : undefined}
              onClick={() => paginate(n)}
              className={`border-border relative z-10 flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium shadow-[0_4px_10px_hsl(var(--foreground)/0.1)] transition-colors duration-300 sm:h-16 sm:w-16 ${
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground bg-background"
              }`}
              whileHover={
                !isActive
                  ? {
                      y: -6,
                      boxShadow: isDark
                        ? "0 10px 20px hsl(var(--foreground)/0.4)"
                        : "0 6px 10px hsl(var(--foreground)/0.12)",
                    }
                  : {}
              }
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="active-page-bg"
                    className="absolute inset-0 overflow-hidden rounded-lg"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 220,
                      damping: 24,
                      mass: 0.8,
                    }}
                  >
                    <div className="bg-primary border-border absolute inset-0 rounded-lg border shadow-[0_8px_16px_-4px_hsl(var(--foreground)/0.7),inset_0_1px_1px_0_hsl(var(--background)/0.15)]" />
                    <motion.div
                      className="via-background/10 absolute -inset-full skew-x-12 bg-linear-to-tr from-transparent to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        repeatDelay: 5,
                        ease: "easeInOut",
                      }}
                    />
                    <span
                      className="pointer-events-none absolute inset-0 rounded-[inherit]"
                      style={{
                        boxShadow: "inset 0 -4px 8px 0 hsl(var(--foreground)/0.6)",
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <span className="relative z-10 text-lg font-semibold sm:text-xl">
                {n}
              </span>
            </motion.button>
          );
        })}
      </div>

      <PageButton disabled={page >= pageCount} onClick={() => paginate(page + 1)}>
        <ChevronRight className="h-5 w-5 sm:h-7 sm:w-7" />
      </PageButton>
    </nav>
  );
};
