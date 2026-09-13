// Wires packages/db's Firestore client factory into Nest's DI container.
// One initialized Firebase Admin app per process — see
// packages/db/client.ts's own comment on why.

import { Global, Module } from "@nestjs/common";
import { createDb, type Db } from "@galleryzone/db";
import { loadEnv, type AppEnv } from "@galleryzone/config";

export const DB = Symbol("DB");
/** The typed env, for the few controllers whose behaviour is env-gated (e.g. PAYMENTS_MODE). */
export const ENV = Symbol("ENV");

@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: (): AppEnv => loadEnv() },
    {
      provide: DB,
      useFactory: (): Db => {
        const env = loadEnv();
        const { db } = createDb(env.firebaseProjectId);
        return db;
      },
    },
  ],
  exports: [DB, ENV],
})
export class DbModule {}
