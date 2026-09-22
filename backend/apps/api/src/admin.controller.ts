import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { z } from "zod";
import { NotFoundException } from "@nestjs/common";
import { FirestoreRateConfigStore, suggestEarningsAbove5L, adminKpis, listCategories, createCategory, updateCategory, deleteCategory, getUserForAdmin, listModerationQueue, listUsersForAdmin, listWithdrawalsForAdmin, setUserStatus, userRoleValues, userStatusValues, type Db, type UserRole } from "@galleryzone/db";
import { loadActiveRates } from "@galleryzone/config";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const nameSchema = z.object({ name: z.string().min(1), slug: z.string().min(1).optional() }).strict();
type NameBody = z.infer<typeof nameSchema>;

const statusSchema = z.object({ status: z.enum([...userStatusValues]) }).strict();
type StatusBody = z.infer<typeof statusSchema>;

@Controller("v1/admin")
export class AdminController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get("kpis")
  kpis() {
    return adminKpis(this.db);
  }

  @Roles("admin")
  @Get("withdrawals")
  async withdrawals() {
    return { withdrawals: await listWithdrawalsForAdmin(this.db) };
  }

  @Roles("admin")
  @Get("moderation/gst")
  async gstQueue() {
    return { users: await listModerationQueue(this.db, "gst") };
  }

  @Roles("admin")
  @Get("moderation/kyc")
  async kycQueue() {
    return { users: await listModerationQueue(this.db, "kyc") };
  }

  @Roles("admin")
  @Get("categories")
  categories() {
    return listCategories(this.db);
  }

  @Roles("admin")
  @Post("categories")
  createCategory(@Body(new ZodValidationPipe(nameSchema)) body: NameBody) {
    return createCategory(this.db, body.name, body.slug ?? body.name.toLowerCase().replace(/\s+/g, "-"));
  }

  @Roles("admin")
  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body(new ZodValidationPipe(nameSchema)) body: NameBody) {
    return updateCategory(this.db, id, body.name);
  }

  @Roles("admin")
  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string) {
    return deleteCategory(this.db, id);
  }

  @Roles("admin")
  @Get("users")
  async users(@Query("role") role?: string) {
    const parsedRole = role && (userRoleValues as readonly string[]).includes(role) ? (role as UserRole) : undefined;
    return { users: await listUsersForAdmin(this.db, parsedRole) };
  }

  @Roles("admin")
  @Get("users/:id")
  async user(@Param("id") id: string) {
    const user = await getUserForAdmin(this.db, id);
    if (!user) throw new NotFoundException({ type: "about:blank", title: "User not found", status: 404, code: "not_found" });
    // The §194-O flag is toggled by hand (PATCH users/:id/earnings-above-5l),
    // and until now the admin doing it had no figure to go on — the
    // suggestion was computed by a function nothing called. Advisory only:
    // crossing the threshold changes what is withheld from an artist, so a
    // person still confirms it.
    if (user.role !== "artist") return { ...user, earningsAbove5LSuggested: false };
    const rates = await loadActiveRates(new FirestoreRateConfigStore(this.db));
    const suggested = await suggestEarningsAbove5L(this.db, id, rates);
    return { ...user, earningsAbove5LSuggested: suggested };
  }

  @Roles("admin")
  @Patch("users/:id/status")
  setUserStatus(@Param("id") id: string, @Body(new ZodValidationPipe(statusSchema)) body: StatusBody) {
    return setUserStatus(this.db, id, body.status);
  }
}
