import { http } from "@/lib/api";
import type { Blog, BlogStatus, SubmitBlogInput, UpdateBlogInput } from "@/types/blog";

// Artist-authored blog posts. Three audiences, one service — public reads
// are open, artist actions require the artist role, admin review requires
// admin. The backend controller enforces all three.

export const blogService = {
  // --- public ---------------------------------------------------------------
  listPublished: async (): Promise<Blog[]> => {
    const { blogs } = await http.get<{ blogs: Blog[] }>("/v1/blogs");
    return blogs;
  },
  getPublished: (slug: string): Promise<Blog> =>
    http.get<Blog>(`/v1/blogs/${encodeURIComponent(slug)}`),

  // --- artist ---------------------------------------------------------------
  listMine: async (): Promise<Blog[]> => {
    const { blogs } = await http.get<{ blogs: Blog[] }>("/v1/artist/blogs");
    return blogs;
  },
  submit: (input: SubmitBlogInput): Promise<Blog> => http.post<Blog>("/v1/artist/blogs", input),
  updateMine: (blogId: string, patch: UpdateBlogInput): Promise<Blog> =>
    http.patch<Blog>(`/v1/artist/blogs/${encodeURIComponent(blogId)}`, patch),
  deleteMine: (blogId: string): Promise<void> =>
    http.delete(`/v1/artist/blogs/${encodeURIComponent(blogId)}`),

  // --- admin ----------------------------------------------------------------
  listForAdmin: async (status?: BlogStatus): Promise<Blog[]> => {
    const { blogs } = await http.get<{ blogs: Blog[] }>("/v1/admin/blogs", {
      params: status ? { status } : {},
    });
    return blogs;
  },
  accept: (blogId: string): Promise<Blog> =>
    http.post<Blog>(`/v1/admin/blogs/${encodeURIComponent(blogId)}/accept`),
  reject: (blogId: string, reason: string): Promise<Blog> =>
    http.post<Blog>(`/v1/admin/blogs/${encodeURIComponent(blogId)}/reject`, { reason }),
};
