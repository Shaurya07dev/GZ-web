// Idempotent admin seed. Runs once per API boot (OnApplicationBootstrap)
// and ensures the one admin account GalleryZone operates with exists:
//   - Firebase Auth user (creates it if missing)
//   - users/{uid} Firestore profile with role:"admin"
//   - password matches ADMIN_SEED_PASSWORD (resets it if it drifted)
//
// Owner directive 3 Nov 2026: admin accounts never go through the self-serve
// register endpoint. This script is the ONLY path that writes role:"admin" in
// the normal flow. (Direct Firestore edits by the owner are the only other
// way, and that's intentional — nothing in the UI can elevate.)
//
// Safety:
//   - If ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD are unset, the seed logs
//     a warning and does nothing. Dev builds don't need this; prod must
//     set both.
//   - Failures NEVER crash the API boot. A seeded admin that can't be
//     synced is a loud log line, not a dead service.

import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { Collections, type Db, type UserDoc } from "@galleryzone/db";
import type { AppEnv } from "@galleryzone/config";
import { DB, ENV } from "./db.module.ts";

@Injectable()
export class AdminSeed implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeed.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: AppEnv,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.run();
    } catch (error) {
      this.logger.error(
        `admin seed failed: ${error instanceof Error ? error.message : String(error)}. ` +
          "The API is up anyway. Investigate and re-deploy — the next boot retries.",
      );
    }
  }

  async run(): Promise<void> {
    const seed = this.env.adminSeed;
    if (!seed) {
      this.logger.warn("ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD not set — admin seed skipped");
      return;
    }
    const auth = getAuth();
    let uid: string;
    try {
      const record = await auth.getUserByEmail(seed.email);
      uid = record.uid;
      // Reset password + verify email + ensure not disabled every boot. This
      // is what makes the seed self-healing: if an operator changed the
      // password in the Firebase console and then forgot it, the next
      // deploy restores the known credential.
      await auth.updateUser(uid, {
        password: seed.password,
        emailVerified: true,
        disabled: false,
      });
      this.logger.log(`admin seed: synced existing account ${seed.email}`);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code !== "auth/user-not-found") throw error;
      const created = await auth.createUser({
        email: seed.email,
        password: seed.password,
        emailVerified: true,
        displayName: "GalleryZone Admin",
      });
      uid = created.uid;
      this.logger.log(`admin seed: created account ${seed.email}`);
    }

    const userRef = this.db.collection(Collections.users).doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
      const existing = snap.data() as UserDoc;
      // Only write what changed, so the audit trail stays focused on real changes.
      const patch: Partial<UserDoc> = {};
      if (existing.role !== "admin") patch.role = "admin";
      if (existing.status !== "active") patch.status = "active";
      if (existing.name !== "GalleryZone Admin") patch.name = "GalleryZone Admin";
      if (existing.email !== seed.email) patch.email = seed.email;
      if (!existing.emailVerifiedAt) {
        patch.emailVerifiedAt = FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp;
      }
      if (Object.keys(patch).length > 0) {
        await userRef.update(patch);
        this.logger.log(`admin seed: patched profile (${Object.keys(patch).join(", ")})`);
      }
      return;
    }
    const doc: UserDoc = {
      firebaseUid: uid,
      role: "admin",
      status: "active",
      name: "GalleryZone Admin",
      email: seed.email,
      phone: null,
      createdAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      lastLoginAt: null,
      roleGrants: ["platform_admin"],
      emailVerifiedAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
      phoneVerifiedAt: null,
    };
    await userRef.set(doc);
    this.logger.log(`admin seed: created users/${uid} profile`);
  }
}
