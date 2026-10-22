// Artist-authored blog posts. Three audiences, one controller:
//   - public         GET  /v1/blogs                 — list published
//                    GET  /v1/blogs/:slug           — read one published
//   - artist         GET  /v1/artist/blogs          — my submissions
//                    POST /v1/artist/blogs          — submit a new one
//                    PATCH /v1/artist/blogs/:id     — edit a draft
//                    DELETE /v1/artist/blogs/:id    — delete a draft
//   - admin          GET  /v1/admin/blogs           — review queue (filter by status)
//                    POST /v1/admin/blogs/:id/accept — publish
//                    POST /v1/admin/blogs/:id/reject — refuse with a reason

import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { z } from "zod";
import {
  acceptBlog,
  Collections,
  deleteBlog,
  getPublishedBlog,
  listArtistBlogs,
  listBlogsForAdmin,
  listPublishedBlogs,
  rejectBlog,
  submitBlog,
  updateBlog,
  type Db,
  type UserDoc,
} from "@galleryzone/db";
import { Public } from "./auth/roles.decorator.ts";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const submitSchema = z
  .object({
    title: z.string().trim().min(4).max(160),
    excerpt: z.string().trim().max(300).optional(),
    body: z.string().trim().min(100).max(20_000),
  })
  .strict();
type SubmitBody = z.infer<typeof submitSchema>;

const updateSchema = z
  .object({
    title: z.string().trim().min(4).max(160).optional(),
    excerpt: z.string().trim().max(300).optional(),
    body: z.string().trim().min(100).max(20_000).optional(),
  })
  .strict();
type UpdateBody = z.infer<typeof updateSchema>;

const rejectSchema = z.object({ reason: z.string().trim().min(4).max(500) }).strict();
type RejectBody = z.infer<typeof rejectSchema>;

@Controller("v1")
export class BlogsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // --- Public --------------------------------------------------------------

  @Public()
  @Get("blogs")
  async listPublic() {
    return { blogs: await listPublishedBlogs(this.db) };
  }

  @Public()
  @Get("blogs/:slug")
  async getPublic(@Param("slug") slug: string) {
    const blog = await getPublishedBlog(this.db, slug);
    if (!blog) throw new NotFoundException({ type: "about:blank", title: "Blog not found", status: 404, code: "not_found" });
    return blog;
  }

  // --- Artist --------------------------------------------------------------

  @Roles("artist")
  @Get("artist/blogs")
  async listMine(@Req() req: AuthenticatedRequest) {
    return { blogs: await listArtistBlogs(this.db, req.authUser.uid) };
  }

  @Roles("artist")
  @Post("artist/blogs")
  async submit(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(submitSchema)) body: SubmitBody) {
    const userSnap = await this.db.collection(Collections.users).doc(req.authUser.uid).get();
    const authorName = (userSnap.data() as UserDoc | undefined)?.name ?? "Artist";
    return submitBlog(this.db, {
      authorId: req.authUser.uid,
      authorName,
      title: body.title,
      excerpt: body.excerpt ?? "",
      body: body.body,
    });
  }

  @Roles("artist")
  @Patch("artist/blogs/:id")
  async updateMine(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(updateSchema)) body: UpdateBody) {
    return updateBlog(this.db, { blogId: id, authorId: req.authUser.uid, patch: body });
  }

  @Roles("artist")
  @Delete("artist/blogs/:id")
  async deleteMine(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    await deleteBlog(this.db, { blogId: id, authorId: req.authUser.uid });
    return { id, deleted: true };
  }

  // --- Admin ---------------------------------------------------------------

  @Roles("admin")
  @Get("admin/blogs")
  async listForAdmin(@Query("status") status?: string) {
    const normalised =
      status === "submitted" || status === "accepted" || status === "rejected" ? status : undefined;
    return { blogs: await listBlogsForAdmin(this.db, normalised) };
  }

  @Roles("admin")
  @Post("admin/blogs/:id/accept")
  async accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return acceptBlog(this.db, { blogId: id, adminId: req.authUser.uid });
  }

  @Roles("admin")
  @Post("admin/blogs/:id/reject")
  async reject(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(rejectSchema)) body: RejectBody) {
    return rejectBlog(this.db, { blogId: id, adminId: req.authUser.uid, reason: body.reason });
  }
}
