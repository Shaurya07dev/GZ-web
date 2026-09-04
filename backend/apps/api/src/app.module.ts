import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { HealthController } from "./health.controller.ts";
import { RateConfigController } from "./rate-config.controller.ts";
import { RolesGuard } from "./auth/roles.guard.ts";
import { requestIdMiddleware } from "./request-id.middleware.ts";

@Module({
  controllers: [HealthController, RateConfigController],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes("*");
  }
}
