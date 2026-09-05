import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";
import { listMessages, markMessageRead, listSupportTickets, submitSupportTicket, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const ticketSchema = z.object({ subject: z.string().min(1), message: z.string().min(1) }).strict();
type TicketBody = z.infer<typeof ticketSchema>;

// One controller, any authenticated role — parity scope, per messaging.ts's
// own header, treats artist/aggregator/customer inboxes identically.
@Controller("v1")
export class MessagingController {
  constructor(@Inject(DB) private readonly db: Db) {}

  // TODO(Phase 1): userId from the authenticated request on every method below.
  @Roles("artist", "aggregator", "customer")
  @Get("messages")
  list() {
    return listMessages(this.db, "TODO-authenticated-user-id");
  }

  @Roles("artist", "aggregator", "customer")
  @Post("messages/:id/read")
  markRead(@Param("id") id: string) {
    return markMessageRead(this.db, "TODO-authenticated-user-id", id);
  }

  @Roles("artist", "aggregator", "customer")
  @Get("support")
  listTickets() {
    return listSupportTickets(this.db, "TODO-authenticated-user-id");
  }

  @Roles("artist", "aggregator", "customer")
  @Post("support")
  submitTicket(@Body(new ZodValidationPipe(ticketSchema)) body: TicketBody) {
    return submitSupportTicket(this.db, "TODO-authenticated-user-id", body.subject, body.message);
  }
}
