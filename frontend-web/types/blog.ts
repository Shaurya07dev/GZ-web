export type BlogStatus = "submitted" | "accepted" | "rejected";

export interface Blog {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  status: BlogStatus;
  decisionNote: string | null;
  submittedAt: string;
  decidedAt: string | null;
  publishedAt: string | null;
}

export interface SubmitBlogInput {
  title: string;
  excerpt?: string;
  body: string;
}

export interface UpdateBlogInput {
  title?: string;
  excerpt?: string;
  body?: string;
}
