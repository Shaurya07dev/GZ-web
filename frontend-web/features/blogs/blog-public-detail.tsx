"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { usePublishedBlog } from "@/hooks/useBlogs";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function BlogPublicDetail({ slugPromise }: { slugPromise: Promise<string> }) {
  const slug = use(slugPromise);
  const { data: blog, isPending, isError } = usePublishedBlog(slug);

  if (isPending) {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-14 lg:px-10">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-6 h-10 w-3/4 animate-pulse rounded bg-muted" />
        <div className="mt-10 flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !blog) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-14 lg:px-10">
      <Link
        href="/blogs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All blogs
      </Link>

      <header className="mt-6 flex flex-col gap-3">
        <h1 className="text-balance font-display text-4xl leading-[1.15] font-semibold sm:text-5xl">
          {blog.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="text-gold-bright">{blog.authorName}</span>
          {blog.publishedAt && <span>· {formatDate(blog.publishedAt)}</span>}
        </div>
      </header>

      <div className="mt-10 flex flex-col gap-5 text-base leading-[1.75] text-foreground/90">
        {blog.body.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i} className="whitespace-pre-wrap">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
