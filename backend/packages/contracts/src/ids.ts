// Firestore document IDs are 20-char auto-IDs (or whatever the writer
// chose — users are keyed by Firebase uid), NOT UUIDs. The Postgres-era
// contracts used z.string().uuid() and would reject every real ID once
// the pivot landed; every id field in a request body goes through this.
import { z } from "zod";

export const firestoreId = z.string().min(1).max(1500).regex(/^[^/]+$/, "document id cannot contain '/'");
