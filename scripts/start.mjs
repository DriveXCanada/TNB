// Production start: run migrations, then start Next.js.
//
// The app keeps its tables in their own Postgres schema ("tnb" by default) so it can share a
// database that already has tables in "public" (e.g. PostGIS's spatial_ref_sys on some hosted
// Postgres templates) without hitting Prisma's P3005 "database schema is not empty" error.
// Set DB_SCHEMA to change it, or put ?schema=... on DATABASE_URL yourself.
import { spawn, spawnSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it in your host's environment variables.");
  process.exit(1);
}
const url = new URL(process.env.DATABASE_URL);
if (!url.searchParams.has("schema")) url.searchParams.set("schema", process.env.DB_SCHEMA || "tnb");
process.env.DATABASE_URL = url.toString();
console.log(`Using database schema "${url.searchParams.get("schema")}"`);

const migrate = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const next = spawn("npx", ["next", "start"], { stdio: "inherit", env: process.env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => next.kill(sig));
next.on("exit", (code) => process.exit(code ?? 0));
