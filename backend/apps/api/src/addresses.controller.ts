import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listAddresses, addAddress, updateAddress, deleteAddress, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const addressSchema = z
  .object({ line1: z.string().min(1), line2: z.string().optional(), city: z.string().min(1), state: z.string().min(1), pincode: z.string().min(1), isDefault: z.boolean().optional() })
  .strict();
type AddressBody = z.infer<typeof addressSchema>;
const addressPatchSchema = addressSchema.partial();
type AddressPatchBody = z.infer<typeof addressPatchSchema>;

@Controller("v1/account/addresses")
export class AddressesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Roles("customer")
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return listAddresses(this.db, req.authUser.uid);
  }

  @Roles("customer")
  @Post()
  add(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(addressSchema)) body: AddressBody) {
    return addAddress(this.db, req.authUser.uid, body);
  }

  @Roles("customer")
  @Patch(":id")
  update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body(new ZodValidationPipe(addressPatchSchema)) body: AddressPatchBody) {
    return updateAddress(this.db, req.authUser.uid, id, body);
  }

  @Roles("customer")
  @Delete(":id")
  remove(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return deleteAddress(this.db, req.authUser.uid, id);
  }
}
