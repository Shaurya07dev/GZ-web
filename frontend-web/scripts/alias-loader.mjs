// Teaches bare `node --experimental-strip-types` the "@/" path alias that
// tsconfig gives the Next build, and the extensionless imports TS allows.
// Without it a check script can only import modules that themselves import
// nothing aliased, which rules out every service.
//
// Usage:
//   node --import ./scripts/alias-loader.mjs --experimental-strip-types <file>.check.ts

import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
