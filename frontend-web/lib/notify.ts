import { toast } from "sonner";

// One place for the "did it work?" box every portal action shows. Hooks
// pass a success line; the error line comes from the thrown Error (API
// errors are already worded for people — see lib/api.ts).
export const notify = {
  success: (message: string, description?: string) => toast.success(message, description ? { description } : undefined),
  error: (fallback: string) => (error: unknown) =>
    toast.error(fallback, { description: error instanceof Error ? error.message : undefined }),
};
