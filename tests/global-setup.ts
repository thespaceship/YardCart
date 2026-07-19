import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const TEST_DB = path.resolve(__dirname, "../prisma/test.db");

export default function setup() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  process.env.DATABASE_URL = `file:./test.db`;
  execSync("npx prisma db push --skip-generate", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
    stdio: "pipe",
  });
  return () => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  };
}
