// Object storage adapter — the only place that holds S3 credentials.
// Railway buckets are private and S3-compatible: uploads go browser →
// bucket with a presigned PUT (bucket ingress is free), reads come back
// through GET /v1/images/* (images.controller.ts) with immutable cache
// headers so Vercel's image optimiser and browsers keep them.

import { Inject, Injectable, Logger, ServiceUnavailableException, type OnModuleInit } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppEnv } from "@galleryzone/config";
import { ENV } from "./db.module.ts";

export interface StoredObject {
  contentType: string | null;
  contentLength: number | null;
  body: NodeJS.ReadableStream;
  etag: string | null;
}

@Injectable()
export class Storage implements OnModuleInit {
  private readonly logger = new Logger(Storage.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly origins: string[];

  constructor(@Inject(ENV) env: AppEnv) {
    this.origins = env.corsOrigins;
    if (!env.s3) {
      this.client = null;
      this.bucket = "";
      this.logger.warn("S3_* not set — image upload/serve routes will answer 503");
      return;
    }
    this.bucket = env.s3.bucket;
    this.client = new S3Client({
      region: env.s3.region,
      endpoint: env.s3.endpoint,
      credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Browsers PUT straight to the bucket, so the BUCKET must answer the
   * preflight: allow PUT from the site origins with any header. Applied on
   * every boot (idempotent) so a new origin in CORS_ORIGINS is picked up
   * without a manual step. A failure here is logged, never fatal.
   */
  async onModuleInit(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              { AllowedOrigins: this.origins, AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 },
            ],
          },
        }),
      );
      this.logger.log(`bucket CORS set for ${this.origins.join(", ")}`);
    } catch (error) {
      this.logger.error(`could not set bucket CORS: ${String(error)}`);
    }
  }

  private s3(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException({ type: "about:blank", title: "Image storage is not configured", status: 503, code: "storage_unavailable" });
    }
    return this.client;
  }

  /** A PUT URL the browser can use for the next few minutes; content type and length are locked into the signature. */
  presignUpload(key: string, contentType: string, contentLength: number): Promise<string> {
    return getSignedUrl(
      this.s3(),
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ContentLength: contentLength }),
      { expiresIn: 10 * 60 },
    );
  }

  /** Server-side put — the fallback when a browser can't reach the bucket directly. */
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3().send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.length }));
  }

  /** What actually landed in the bucket, or null if nothing did. */
  async head(key: string): Promise<{ contentType: string | null; contentLength: number | null } | null> {
    try {
      const res = await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { contentType: res.ContentType ?? null, contentLength: res.ContentLength ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return {
        contentType: res.ContentType ?? null,
        contentLength: res.ContentLength ?? null,
        etag: res.ETag ?? null,
        body: res.Body as unknown as NodeJS.ReadableStream,
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}
