// Run: node --experimental-strip-types apps/api/src/route-param.check.ts
import assert from "node:assert/strict";
import { RouteParamPipe, isSafeRouteParam } from "./route-param.pipe.ts";

for (const ok of ["abc123", "gz-dl-8f2c", "my-blog-slug", "a1b2.webp", "x".repeat(200)]) assert.ok(isSafeRouteParam(ok), ok);
for (const bad of ["a/pricing/data", "", "x".repeat(201), undefined, 42]) assert.ok(!isSafeRouteParam(bad), String(bad));

const pipe = new RouteParamPipe();
assert.equal(pipe.transform("abc", { type: "param" }), "abc");
assert.throws(() => pipe.transform("a/pricing/data", { type: "param" }), /Bad Request|Malformed/);
// Bodies and queries are the zod pipes' job, not this one's.
assert.deepEqual(pipe.transform({ path: "a/b" }, { type: "body" }), { path: "a/b" });
assert.equal(pipe.transform("a/b", { type: "query" }), "a/b");

console.log("apps/api/route-param: ids with '/' or over 200 chars refused, bodies/queries untouched");
