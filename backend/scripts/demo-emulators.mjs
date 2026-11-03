// Starts the local Firestore + Auth emulators for the demo stack (project demo-gz,
// ports in firebase.demo.json). The seeded data is kept in backend/.demo-data: it
// is loaded on start when present and written back on a clean exit (Ctrl+C), so a
// restart keeps the demo data and `npm run demo:clear` is the only thing that removes it.
//   npm run demo:emulators
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = ".demo-data";
const args = ["firebase-tools", "emulators:start", "--config", "firebase.demo.json", "--project", "demo-gz", "--only", "firestore,auth", "--export-on-exit", dataDir];
if (existsSync(resolve(root, dataDir))) args.push("--import", dataDir);

spawn("npx", args, { cwd: root, stdio: "inherit", shell: true });
