import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { listAddresses, addAddress, updateAddress, deleteAddress, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
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

  // TODO(Phase 1): userId comes from the authenticated request on every
  // method below, never a param/body — there is no such param today.
  @Roles("customer")
  @Get()
  list() {
    return listAddresses(this.db, "TODO-authenticated-user-id");
  }

  @Roles("customer")
  @Post()
  add(@Body(new ZodValidationPipe(addressSchema)) body: AddressBody) {
    return addAddress(this.db, "TODO-authenticated-user-id", body);
  }

  @Roles("customer")
  @Patch(":id")
  update(@Param("id") id: string, @Body(new ZodValidationPipe(addressPatchSchema)) body: AddressPatchBody) {
    return updateAddress(this.db, "TODO-authenticated-user-id", id, body);
  }

  @Roles("customer")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return deleteAddress(this.db, "TODO-authenticated-user-id", id);
  }
}
