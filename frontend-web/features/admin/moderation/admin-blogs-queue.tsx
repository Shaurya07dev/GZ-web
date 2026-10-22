"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Check, ExternalLink, PenTool, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  useAcceptBlogMutation,
  useAdminBlogs,
  useRejectBlogMutation,
} from "@/hooks/useBlogs";
import type { Blog, BlogStatus } from "@/types/blog";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const TABS: { value: BlogStatus; label: string }[] = [
  { value: "submitted", label: "In review" },
  { value: "accepted", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

export function AdminBlogsQueue() {
  const [tab, setTab] = useState<BlogStatus>("submitted");
  const { data: blogs, isPending } = useAdminBlogs(tab);
  const [reviewing, setReviewing] = useState<Blog | null>(null);

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as BlogStatus)}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="rounded-full border border-border px-4 py-2 text-sm text-muted-foreground data-active:border-gold/50 data-active:bg-gold/10 data-active:text-gold-bright after:hidden"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-6">
            {isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
                ))}
              </div>
            ) : !blogs || blogs.length === 0 ? (
              <EmptyState
                icon={PenTool}
                title={`No ${t.label.toLowerCase()}`}
                description="Posts appear here as artists submit them."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {blogs.map((blog) => (
                  <li
                    key={blog.id}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-base font-semibold text-foreground">
                        {blog.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="text-gold-bright">{blog.authorName}</span>
                        {" · "}submitted {formatDate(blog.submittedAt)}
                        {blog.publishedAt ? ` · published ${formatDate(blog.publishedAt)}` : ""}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {blog.excerpt || blog.body.slice(0, 160)}
                      </p>
                      {blog.status === "rejected" && blog.decisionNote && (
                        <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                          Rejected with: {blog.decisionNote}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {blog.status === "accepted" && (
                        <Link
                          href={`/blogs/${blog.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5" />
                          Open
                        </Link>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewing(blog)}
                      >
                        Review
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <BlogReviewDialog blog={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}

function BlogReviewDialog({
  blog,
  onClose,
}: {
  blog: Blog | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const acceptMutation = useAcceptBlogMutation();
  const rejectMutation = useRejectBlogMutation();
  const [mode, setMode] = useState<"idle" | "rejecting">("idle");

  async function handleAccept() {
    if (!blog) return;
    try {
      await acceptMutation.mutateAsync(blog.id);
      onClose();
    } catch {
      toast.error("Couldn't publish the post. Try again.");
    }
  }

  async function handleReject() {
    if (!blog) return;
    if (reason.trim().length < 4) {
      toast.error("Add a short reason — the author will see this.");
      return;
    }
    try {
      await rejectMutation.mutateAsync({ blogId: blog.id, reason: reason.trim() });
      setMode("idle");
      setReason("");
      onClose();
    } catch {
      toast.error("Couldn't reject. Try again.");
    }
  }

  const isBusy = acceptMutation.isPending || rejectMutation.isPending;

  return (
    <Dialog
      open={Boolean(blog)}
      onOpenChange={(open) => {
        if (!open) {
          setMode("idle");
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        {blog && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{blog.title}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              <span className="text-gold-bright">{blog.authorName}</span>
              {" · "}submitted {formatDate(blog.submittedAt)}
            </p>

            {blog.excerpt && (
              <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm italic text-muted-foreground">
                {blog.excerpt}
              </p>
            )}

            <div className="flex flex-col gap-4 border-t border-border pt-4 text-sm leading-[1.75] text-foreground/90">
              {blog.body.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>

            {mode === "rejecting" ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                <Label htmlFor="rejectReason">Reason (shown to the author)</Label>
                <Textarea
                  id="rejectReason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="E.g. the piece reads as a product promotion — rewrite in a more personal, essay style and resubmit."
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isBusy || reason.trim().length < 4}
                  >
                    <X className="size-3.5" />
                    {rejectMutation.isPending ? "Rejecting…" : "Confirm reject"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMode("idle");
                      setReason("");
                    }}
                    disabled={isBusy}
                  >
                    Back
                  </Button>
                </div>
              </div>
            ) : (
              blog.status === "submitted" && (
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                  <Button onClick={handleAccept} disabled={isBusy}>
                    <Check className="size-4" />
                    {acceptMutation.isPending ? "Publishing…" : "Accept + publish"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMode("rejecting")}
                    disabled={isBusy}
                  >
                    <X className="size-4" />
                    Reject
                  </Button>
                </div>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
