import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.ts";
import { RateConfigController } from "./rate-config.controller.ts";

@Module({
  controllers: [HealthController, RateConfigController],
})
export class AppModule {}
