// Run: npm run check:min-photos
//
// The photo rule from the client (18 Nov 2026): three photos before a piece goes to review. The database part (a
// draft with two photos refused, with three accepted) needs Firestore; this pins the number and the wording.

import assert from "node:assert/strict";
import { MIN_ARTWORK_IMAGES, minPhotosMessage } from "./artist-artworks.ts";

assert.equal(MIN_ARTWORK_IMAGES, 3);
assert.match(minPhotosMessage(0), /at least 3 photos/);
assert.match(minPhotosMessage(0), /3 more needed/);
assert.match(minPhotosMessage(2), /1 more needed/);
assert.match(minPhotosMessage(5), /0 more needed/, "never a negative number");
assert.match(minPhotosMessage(1), /different angles/, "the angles hint is part of the message");

console.log("min-photos.check.ts: ok");
