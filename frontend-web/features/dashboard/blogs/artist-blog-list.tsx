"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, PenTool, Check, X, Clock3, Trash2 } from "lucide-react";
import {
  useDeleteBlogMutation,
  useMyBlogs,
} from "@/hooks/useBlogs";
import type { Blog, BlogStatus } from "@/types/blog";

const STATUS_STYLE: Record<BlogStatus, string> = {
  submitted: "border-gold/40 bg-gold/10 text-gold-bright",
  accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<BlogStatus, string> = {
  submitted: "In review",
  accepted: "Published",
  rejected: "Not accepted",
};

const STATUS_ICON: Record<BlogStatus, typeof Clock3> = {
  submitted: Clock3,
  accepted: Check,
  rejected: X,
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function ArtistBlogList() {
  const { data: blogs, isPending } = useMyBlogs();
  const deleteMutation = useDeleteBlogMutation();
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Your blogs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Write about your practice. Our editors read every submission and
            publish the pieces that fit on <Link href="/blogs" className="text-gold-bright hover:underline">/blogs</Link>.
          </p>
        </div>
        <Link
          href="/dashboard/blogs/new"
          className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-5 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02]"
        >
          <Plus className="size-4" />
          Write a new post
        </Link>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-card" />
          ))}
        </div>
      ) : !blogs || blogs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
            <PenTool className="size-4 text-gold-bright" strokeWidth={1.75} />
          </span>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nothing yet. Share a studio story, a technique note, or what&rsquo;s
            on your easel this week.
          </p>
          <Link
            href="/dashboard/blogs/new"
            className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
          >
            Write your first post
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {blogs.map((blog) => (
            <BlogRow
              key={blog.id}
              blog={blog}
              confirming={confirming === blog.id}
              onConfirmDelete={() => setConfirming(blog.id)}
              onCancelDelete={() => setConfirming(null)}
              onDelete={() => {
                deleteMutation.mutate(blog.id, {
                  onSuccess: () => setConfirming(null),
                });
              }}
              deleting={deleteMutation.isPending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function BlogRow({
  blog,
  confirming,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
  deleting,
}: {
  blog: Blog;
  confirming: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const Icon = STATUS_ICON[blog.status];
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-display text-base font-semibold text-foreground">
            {blog.title}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[blog.status]}`}
          >
            <Icon className="size-3" strokeWidth={2} />
            {STATUS_LABEL[blog.status]}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {blog.excerpt || blog.body.slice(0, 160)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Submitted {formatDate(blog.submittedAt)}
          {blog.publishedAt ? ` · published ${formatDate(blog.publishedAt)}` : ""}
        </p>
        {blog.status === "rejected" && blog.decisionNote && (
          <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <span className="font-medium">Editor&rsquo;s note:</span> {blog.decisionNote}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {blog.status === "accepted" && (
          <Link
            href={`/blogs/${blog.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 px-3 py-1.5 text-xs font-medium text-gold-bright hover:border-gold hover:bg-gold/10"
          >
            View on site
          </Link>
        )}
        {blog.status === "submitted" && (
          <>
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:border-destructive hover:bg-destructive/20 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={onCancelDelete}
                  disabled={deleting}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete draft
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
