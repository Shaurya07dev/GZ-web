// Run: node --experimental-strip-types packages/contracts/src/api-routes.check.ts

import assert from "node:assert/strict";
import { apiRoutes } from "./api-routes.ts";

const seen = new Set<string>();
for (const route of apiRoutes) {
  const key = `${route.method} ${route.path}`;
  assert.ok(!seen.has(key), `duplicate route: ${key}`);
  seen.add(key);
  assert.ok(route.summary.length > 0, `${key} is missing a summary`);
  assert.ok(route.path.startsWith("/v1/"), `${key} is missing the /v1/ prefix`);
}

console.log(`packages/contracts/api-routes.ts: ${apiRoutes.length} routes, all unique, all /v1/-prefixed`);
