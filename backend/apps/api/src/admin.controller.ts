import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { getAdminKpis, listCategories, createCategory, updateCategory, deleteCategory, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const nameSchema = z.object({ name: z.string().min(1), slug: z.string().min(1).optional() }).strict();
type NameBody = z.infer<typeof nameSchema>;

@Controller("v1/admin")
export class AdminController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("admin")
  @Get("kpis")
  kpis() {
    return getAdminKpis(this.db);
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
}
