import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { listMessages, markMessageRead, listSupportTickets, submitSupportTicket, type Db } from "@galleryzone/db";
import { Roles } from "./auth/roles.decorator.ts";
import { Emails } from "./mail/emails.ts";
import type { AuthenticatedRequest } from "./auth/roles.guard.ts";
import { DB } from "./db.module.ts";
import { ZodValidationPipe } from "./zod-validation.pipe.ts";

const ticketSchema = z.object({ subject: z.string().min(1), message: z.string().min(1) }).strict();
type TicketBody = z.infer<typeof ticketSchema>;

// One controller, any authenticated role — parity scope, per messaging.ts's
// own header, treats artist/aggregator/customer inboxes identically.
@Controller("v1")
export class MessagingController {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly emails: Emails,
  ) {}

  @Roles("artist", "aggregator", "customer")
  @Get("messages")
  list(@Req() req: AuthenticatedRequest) {
    return listMessages(this.db, req.authUser.uid);
  }

  @Roles("artist", "aggregator", "customer")
  @Post("messages/:id/read")
  markRead(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return markMessageRead(this.db, req.authUser.uid, id);
  }

  @Roles("artist", "aggregator", "customer")
  @Get("support")
  listTickets(@Req() req: AuthenticatedRequest) {
    return listSupportTickets(this.db, req.authUser.uid);
  }

  @Roles("artist", "aggregator", "customer")
  @Post("support")
  async submitTicket(@Req() req: AuthenticatedRequest, @Body(new ZodValidationPipe(ticketSchema)) body: TicketBody) {
    const ticket = await submitSupportTicket(this.db, req.authUser.uid, body.subject, body.message);
    void this.emails
      .supportTicketRaised({ ticketId: ticket.id, userId: req.authUser.uid, subject: body.subject, message: body.message })
      .catch(this.emails.swallow("support ticket mail"));
    return ticket;
  }
}
