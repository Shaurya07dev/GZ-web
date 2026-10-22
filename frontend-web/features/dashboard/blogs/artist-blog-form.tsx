"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitBlogMutation } from "@/hooks/useBlogs";

const MIN_BODY = 100;
const MIN_TITLE = 4;

export function ArtistBlogForm() {
  const router = useRouter();
  const submitMutation = useSubmitBlogMutation();
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");

  const titleTooShort = title.trim().length > 0 && title.trim().length < MIN_TITLE;
  const bodyTooShort = body.trim().length > 0 && body.trim().length < MIN_BODY;
  const canSubmit =
    title.trim().length >= MIN_TITLE &&
    body.trim().length >= MIN_BODY &&
    !submitMutation.isPending;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    submitMutation.mutate(
      {
        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        body: body.trim(),
      },
      {
        onSuccess: () => router.push("/dashboard/blogs"),
      },
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link
        href="/dashboard/blogs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All my blogs
      </Link>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Write a blog
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a studio story, a technique note, or a reflection on your
          practice. Our editors read every submission and publish the pieces
          that fit the editorial tone.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-6 rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="blogTitle">Title</Label>
          <Input
            id="blogTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={160}
            placeholder="A short, clear title"
            className="h-11"
            aria-invalid={titleTooShort}
          />
          {titleTooShort && (
            <p className="text-xs text-destructive">
              Give it at least {MIN_TITLE} characters.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="blogExcerpt">Excerpt (optional)</Label>
          <Input
            id="blogExcerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            maxLength={300}
            placeholder="One sentence that previews the piece on the blog list"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            If you leave this blank, the first 180 characters of your post are
            used instead.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="blogBody">Your post</Label>
          <Textarea
            id="blogBody"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={20_000}
            rows={16}
            placeholder="Write as much or as little as you like. Paragraphs are preserved — leave a blank line between them."
            className="min-h-[22rem] resize-y leading-relaxed"
            aria-invalid={bodyTooShort}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Plain text; links and formatting can be added by our editors.</span>
            <span className={bodyTooShort ? "text-destructive" : ""}>
              {body.trim().length} / {MIN_BODY} min
            </span>
          </div>
        </div>

        {submitMutation.isError && (
          <p className="text-sm text-destructive">
            {submitMutation.error instanceof Error
              ? submitMutation.error.message
              : "Couldn't submit the post. Please try again."}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-gold-bright to-gold px-6 py-2.5 text-sm font-semibold text-[#171310] transition-transform hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50"
          >
            <Check className="size-4" />
            {submitMutation.isPending ? "Submitting…" : "Submit for review"}
          </button>
          <Link
            href="/dashboard/blogs"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
