// Firebase Admin SDK / Firestore client factory. One initialized app per
// process — apps/api calls this once at bootstrap, same "one pool per
// process" discipline the Postgres version's client.ts had.
//
// Credentials: firebase-admin's applicationDefault() reads
// GOOGLE_APPLICATION_CREDENTIALS automatically (the service-account JSON
// path from .env) — never hardcode a key path or inline a credential
// object here.
//
// Emulator: when FIRESTORE_EMULATOR_HOST is set (the check scripts set
// this), the Admin SDK talks to the local emulator instead of production
// Firestore automatically — no code branch needed here for that.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

export type Db = Firestore;

let app: App | undefined;

export function createDb(projectId: string): { db: Db; close: () => Promise<void> } {
  if (!app) {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    // The emulator doesn't check credentials at all, but initializeApp()
    // still needs *some* credential object when not targeting the
    // emulator — applicationDefault() would also work, but requires the
    // env var to point at a real file either way, so reading it explicitly
    // here gives a clearer error message if it's missing or malformed.
    const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    if (usingEmulator) {
      app = getApps()[0] ?? initializeApp({ projectId });
    } else {
      if (!credentialsPath) {
        throw new Error(
          "GOOGLE_APPLICATION_CREDENTIALS is not set. Generate a service-account key at " +
            "https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk and set its path in .env.",
        );
      }
      const serviceAccount = JSON.parse(readFileSync(credentialsPath, "utf8"));
      app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount), projectId });
    }
  }
  const db = getFirestore(app);
  return { db, close: async () => {} }; // Admin SDK has no pool to drain — kept for interface parity with callers
}
