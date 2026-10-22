// Artist-authored blog posts. Artists submit through the dashboard; an admin
// reviews each one and either accepts (which publishes it to /blogs) or
// rejects with a reason. The public read is restricted to `accepted`
// entries — everything else only reaches the author and the admins.

import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { Collections, type BlogDoc, type BlogStatus } from "./collections.ts";
import { DbError } from "./errors.ts";

export class BlogError extends DbError {}

export interface BlogRow extends Omit<BlogDoc, "submittedAt" | "decidedAt" | "publishedAt"> {
  id: string;
  submittedAt: string;
  decidedAt: string | null;
  publishedAt: string | null;
}

function toRow(id: string, d: BlogDoc): BlogRow {
  return {
    id,
    authorId: d.authorId,
    authorName: d.authorName,
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    body: d.body,
    coverImageUrl: d.coverImageUrl,
    status: d.status,
    decisionNote: d.decisionNote,
    submittedAt: d.submittedAt?.toDate().toISOString() ?? new Date(0).toISOString(),
    decidedAt: d.decidedAt?.toDate().toISOString() ?? null,
    publishedAt: d.publishedAt?.toDate().toISOString() ?? null,
    decidedBy: d.decidedBy,
  };
}

/** Turn a title into a URL-safe slug. Dedup is handled by the submit path. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(db: Firestore, base: string): Promise<string> {
  if (!base) base = "post";
  const col = db.collection(Collections.blogs);
  // Try the base, then base-2, base-3, ... until we miss. Blog volume is low
  // enough that a few sequential reads is fine.
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const snap = await col.where("slug", "==", candidate).limit(1).get();
    if (snap.empty) return candidate;
  }
  // Fallback — extremely unlikely to reach here.
  return `${base}-${Date.now()}`;
}

export interface SubmitBlogInput {
  authorId: string;
  authorName: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl?: string | null;
}

/** Artist submits a new post. Status starts at `submitted` for admin review. */
export async function submitBlog(db: Firestore, input: SubmitBlogInput): Promise<BlogRow> {
  const title = input.title.trim();
  const body = input.body.trim();
  const excerpt = input.excerpt.trim() || body.slice(0, 180);
  if (title.length < 4) throw new BlogError("Title must be at least 4 characters");
  if (body.length < 100) throw new BlogError("The post is too short — write at least 100 characters");

  const slug = await uniqueSlug(db, slugify(title));
  const doc: BlogDoc = {
    authorId: input.authorId,
    authorName: input.authorName,
    title,
    slug,
    excerpt,
    body,
    coverImageUrl: input.coverImageUrl ?? null,
    status: "submitted",
    decisionNote: null,
    submittedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
    decidedAt: null,
    decidedBy: null,
    publishedAt: null,
  };
  const ref = await db.collection(Collections.blogs).add(doc);
  const saved = await ref.get();
  return toRow(ref.id, saved.data() as BlogDoc);
}

/** Artist edits a draft (only while still `submitted`). */
export async function updateBlog(
  db: Firestore,
  { blogId, authorId, patch }: { blogId: string; authorId: string; patch: { title?: string; excerpt?: string; body?: string } },
): Promise<BlogRow> {
  const ref = db.collection(Collections.blogs).doc(blogId);
  const snap = await ref.get();
  const doc = snap.data() as BlogDoc | undefined;
  if (!doc) throw new BlogError(`No blog ${blogId}`);
  if (doc.authorId !== authorId) throw new BlogError(`No blog ${blogId}`);
  if (doc.status !== "submitted") throw new BlogError("A reviewed post can't be edited — contact GalleryZone");
  const update: Partial<BlogDoc> = {};
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.excerpt !== undefined) update.excerpt = patch.excerpt.trim();
  if (patch.body !== undefined) update.body = patch.body.trim();
  await ref.update(update);
  const after = await ref.get();
  return toRow(ref.id, after.data() as BlogDoc);
}

/** Artist deletes a draft (only while still `submitted`). */
export async function deleteBlog(db: Firestore, { blogId, authorId }: { blogId: string; authorId: string }): Promise<void> {
  const ref = db.collection(Collections.blogs).doc(blogId);
  const snap = await ref.get();
  const doc = snap.data() as BlogDoc | undefined;
  if (!doc) throw new BlogError(`No blog ${blogId}`);
  if (doc.authorId !== authorId) throw new BlogError(`No blog ${blogId}`);
  if (doc.status !== "submitted") throw new BlogError("A reviewed post can't be deleted");
  await ref.delete();
}

/** Artist's own list — every status, newest first. */
export async function listArtistBlogs(db: Firestore, authorId: string): Promise<BlogRow[]> {
  const snap = await db.collection(Collections.blogs).where("authorId", "==", authorId).get();
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as BlogDoc));
  return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Admin review queue — filtered by status, newest first. */
export async function listBlogsForAdmin(db: Firestore, status?: BlogStatus): Promise<BlogRow[]> {
  let query = db.collection(Collections.blogs) as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as BlogDoc));
  return rows.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Public read — only `accepted` entries, newest first by publishedAt. */
export async function listPublishedBlogs(db: Firestore): Promise<BlogRow[]> {
  const snap = await db.collection(Collections.blogs).where("status", "==", "accepted").get();
  const rows = snap.docs.map((d) => toRow(d.id, d.data() as BlogDoc));
  return rows.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

/** Public read of one post by slug. Returns null for unknown / unpublished. */
export async function getPublishedBlog(db: Firestore, slug: string): Promise<BlogRow | null> {
  const snap = await db.collection(Collections.blogs).where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  const doc = d.data() as BlogDoc;
  if (doc.status !== "accepted") return null;
  return toRow(d.id, doc);
}

/** Admin accepts a submitted post — publishes it immediately. */
export async function acceptBlog(db: Firestore, { blogId, adminId }: { blogId: string; adminId: string }): Promise<BlogRow> {
  const ref = db.collection(Collections.blogs).doc(blogId);
  const snap = await ref.get();
  const doc = snap.data() as BlogDoc | undefined;
  if (!doc) throw new BlogError(`No blog ${blogId}`);
  if (doc.status === "accepted") return toRow(ref.id, doc);
  await ref.update({
    status: "accepted",
    decidedBy: adminId,
    decidedAt: FieldValue.serverTimestamp(),
    publishedAt: FieldValue.serverTimestamp(),
    decisionNote: null,
  });
  const after = await ref.get();
  return toRow(ref.id, after.data() as BlogDoc);
}

/** Admin rejects with a reason the author sees. */
export async function rejectBlog(
  db: Firestore,
  { blogId, adminId, reason }: { blogId: string; adminId: string; reason: string },
): Promise<BlogRow> {
  const ref = db.collection(Collections.blogs).doc(blogId);
  const snap = await ref.get();
  const doc = snap.data() as BlogDoc | undefined;
  if (!doc) throw new BlogError(`No blog ${blogId}`);
  await ref.update({
    status: "rejected",
    decidedBy: adminId,
    decidedAt: FieldValue.serverTimestamp(),
    decisionNote: reason.trim() || "The post didn't fit our editorial brief.",
    publishedAt: null,
  });
  const after = await ref.get();
  return toRow(ref.id, after.data() as BlogDoc);
}
