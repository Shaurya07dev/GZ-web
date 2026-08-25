// Resolver hooks for the check scripts. See alias-loader.mjs.

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = pathToFileURL(`${import.meta.dirname}/../`).href;

// TS source omits the extension; node insists on one. Try `.ts`, then an
// `index.ts`, before giving up and letting node report the miss itself.
function withExtension(url) {
  const path = fileURLToPath(url);
  if (/\.[a-z]+$/i.test(path)) return url;
  if (existsSync(`${path}.ts`)) return `${url}.ts`;
  if (existsSync(`${path}/index.ts`)) return `${url}/index.ts`;
  return url;
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    return next(withExtension(new URL(specifier.slice(2), root).href), context);
  }
  // Relative imports inside those modules drop the extension too.
  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    return next(withExtension(new URL(specifier, context.parentURL).href), context);
  }
  return next(specifier, context);
}
