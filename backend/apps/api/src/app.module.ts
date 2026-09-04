import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { HealthController } from "./health.controller.ts";
import { RateConfigController } from "./rate-config.controller.ts";
import { ArtworksController } from "./artworks.controller.ts";
import { OrdersController } from "./orders.controller.ts";
import { AggregatorController } from "./aggregator.controller.ts";
import { ModerationController } from "./moderation.controller.ts";
import { RolesGuard } from "./auth/roles.guard.ts";
import { requestIdMiddleware } from "./request-id.middleware.ts";
import { DbModule } from "./db.module.ts";

@Module({
  imports: [DbModule],
  controllers: [HealthController, RateConfigController, ArtworksController, OrdersController, AggregatorController, ModerationController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes("*");
  }
}
