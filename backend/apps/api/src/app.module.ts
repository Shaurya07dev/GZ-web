import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { HealthController } from "./health.controller.ts";
import { RateConfigController } from "./rate-config.controller.ts";
import { ArtworksController } from "./artworks.controller.ts";
import { OrdersController } from "./orders.controller.ts";
import { AggregatorController } from "./aggregator.controller.ts";
import { ModerationController } from "./moderation.controller.ts";
import { ArtistArtworksController } from "./artist-artworks.controller.ts";
import { WithdrawalsController, AdminWithdrawalsController } from "./withdrawals.controller.ts";
import { ArtistWalletController, AggregatorWalletController, CustomerWalletController } from "./wallets.controller.ts";
import { AdminController } from "./admin.controller.ts";
import { PublicArtistsController } from "./public-profiles.controller.ts";
import { AdminArtworksController } from "./admin-artworks.controller.ts";
import { AddressesController } from "./addresses.controller.ts";
import { AdminSettlementsController } from "./admin-settlements.controller.ts";
import { AggregatorSalesController } from "./aggregator-sales.controller.ts";
import { RolesGuard } from "./auth/roles.guard.ts";
import { requestIdMiddleware } from "./request-id.middleware.ts";
import { DbModule } from "./db.module.ts";

@Module({
  imports: [DbModule],
  controllers: [
    HealthController,
    RateConfigController,
    ArtworksController,
    OrdersController,
    AggregatorController,
    ModerationController,
    ArtistArtworksController,
    WithdrawalsController,
    AdminWithdrawalsController,
    ArtistWalletController,
    AggregatorWalletController,
    CustomerWalletController,
    AdminController,
    PublicArtistsController,
    AdminArtworksController,
    AddressesController,
    AdminSettlementsController,
    AggregatorSalesController,
  ],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes("*");
  }
}
