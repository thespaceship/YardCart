import { execSync } from "child_process";
import path from "path";
import { loadEnvConfig } from "@next/env";

const ROOT = path.resolve(__dirname, "..");

/**
 * Tests run against a real Postgres database — point TEST_DATABASE_URL (or DATABASE_URL,
 * e.g. from .env) at an ISOLATED branch, never production. With Neon: create a branch
 * (Branches → Create Branch) and use its connection string. See docs/TESTING.md.
 *
 * Tests create their own uniquely-named yards and clean up after themselves, so a shared
 * dev branch is fine; the database is not wiped.
 */
export default function setup() {
  loadEnvConfig(ROOT); // load .env the same way Next.js does (does not override real env)
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url)) {
    throw new Error(
      "Tests need a Postgres connection string in TEST_DATABASE_URL or DATABASE_URL " +
        "(a Neon dev/test branch — never production). See docs/TESTING.md."
    );
  }
  process.env.DATABASE_URL = url;
  execSync("npx prisma db push --skip-generate", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
