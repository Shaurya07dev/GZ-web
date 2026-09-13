// Wires packages/db's Firestore client factory into Nest's DI container.
// One initialized Firebase Admin app per process — see
// packages/db/client.ts's own comment on why.

import { Global, Module } from "@nestjs/common";
import { createDb, type Db } from "@galleryzone/db";
import { loadEnv } from "@galleryzone/config";

export const DB = Symbol("DB");

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: (): Db => {
        const env = loadEnv();
        const { db } = createDb(env.firebaseProjectId);
        return db;
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
