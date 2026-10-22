"use client";

import Link from "next/link";
import { ArrowRight, PenTool } from "lucide-react";
import { usePublishedBlogs } from "@/hooks/useBlogs";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function BlogsPublicList() {
  const { data: blogs, isPending } = usePublishedBlogs();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!blogs || blogs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-16 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-gold/40 bg-gold/10">
          <PenTool className="size-4 text-gold-bright" strokeWidth={1.75} />
        </span>
        <div className="max-w-sm">
          <p className="font-display text-lg text-foreground">Opening shortly</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The first essays are with our editors. Check back here in a few days.
          </p>
        </div>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 text-sm font-medium text-gold-bright hover:underline"
        >
          Artist? Pitch an essay
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {blogs.map((blog) => (
        <li key={blog.id} className="py-6 first:pt-0">
          <Link
            href={`/blogs/${blog.slug}`}
            className="group flex flex-col gap-2"
          >
            <h2 className="font-display text-2xl leading-tight font-semibold text-foreground transition-colors group-hover:text-gold-bright">
              {blog.title}
            </h2>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {blog.excerpt}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="text-gold-bright">{blog.authorName}</span>
              {blog.publishedAt && <span>{formatDate(blog.publishedAt)}</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
