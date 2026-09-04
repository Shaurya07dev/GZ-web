// Wires packages/db's connection-pool factory into Nest's DI container.
// One pool per process (createDb() is called exactly once, in the
// provider factory below, not per-request) — see packages/db/client.ts's
// own comment on why.

import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { createDb, type Db } from "@galleryzone/db";
import { loadEnv } from "@galleryzone/config";

export const DB = Symbol("DB");

let closeFn: (() => Promise<void>) | null = null;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Db => {
        const env = loadEnv();
        const { db, close } = createDb(env.databaseUrl);
        closeFn = close;
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    if (closeFn) await closeFn();
  }
}
