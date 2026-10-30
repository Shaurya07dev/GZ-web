// Run: node scripts/client-routes.check.mjs
// Every /v1 call the website or the mobile app makes must hit a route a Nest
// controller actually declares. Catches client/server path drift, e.g. the
// admin GST/KYC buttons posting to /v1/moderation/... (404) instead of
// /v1/admin/moderation/....
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

// Known drifts, each a tracked bug, not an allowance — fix and delete. Empty is the goal.
const KNOWN_DRIFT = new Set([]);

const walk = (d, ext) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  if (f === "node_modules" || f === ".next" || f === "dist") return [];
  return statSync(p).isDirectory() ? walk(p, ext) : ext.some((e) => p.endsWith(e)) ? [p] : [];
});

const routes = [];
for (const file of walk(join(root, "backend/apps/api/src"), [".controller.ts"])) {
  let prefix = "";
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const c = line.match(/@Controller\(\s*"([^"]*)"/);
    if (c) prefix = c[1];
    const m = line.match(/@(Get|Post|Patch|Put|Delete)\(\s*(?:"([^"]*)")?/);
    if (m) {
      const path = ("/" + [prefix, m[2] ?? ""].filter(Boolean).join("/")).replace(/\/+/g, "/").replace(/\/$/, "");
      routes.push({ method: m[1].toUpperCase(), segs: path.split("/") });
    }
  }
}

const calls = [];
for (const file of walk(join(root, "frontend-web"), [".ts", ".tsx"])) {
  for (const m of readFileSync(file, "utf8").matchAll(/http\.(get|post|patch|put|delete)\s*(?:<[^>]*(?:<[^>]*>[^>]*)*>)?\(\s*[`"']([^`"']+)/g)) {
    calls.push({ file, method: m[1].toUpperCase(), raw: m[2] });
  }
}
for (const file of walk(join(root, "mobile/lib"), [".dart"])) {
  for (const m of readFileSync(file, "utf8").matchAll(/\b_?(get|post|patch|put|delete)\w*\(\s*'(\/v1\/[^']+)'/gi)) {
    calls.push({ file, method: m[1].toUpperCase(), raw: m[2] });
  }
}
assert.ok(routes.length > 100 && calls.length > 100, "scanner found too little — a regex no longer matches the code");

const unmatched = [];
for (const c of calls) {
  // A trailing ${query} is a query string; any other ${x}/$x is a wildcard segment.
  const path = c.raw.split("?")[0].replace(/\$\{query[^}]*\}$/i, "").replace(/\$\{.*?(\}|$)/g, "*").replace(/\$\w+/g, "*").replace(/\/$/, "");
  if (!path.startsWith("/v1")) continue;
  const segs = path.split("/");
  const hit = routes.some((r) => r.method === c.method && r.segs.length === segs.length
    && r.segs.every((s, i) => s === segs[i] || s.startsWith(":") || segs[i] === "*"));
  if (!hit && !KNOWN_DRIFT.has(`${c.method} ${path}`)) unmatched.push(`${c.method} ${c.raw}  (${c.file.slice(root.length)})`);
}
assert.deepEqual(unmatched, [], `client calls with no backend route:\n  ${unmatched.join("\n  ")}`);
console.log(`client routes: ${calls.length} web/mobile calls all hit one of ${routes.length} controller routes (${KNOWN_DRIFT.size} known drift)`);
