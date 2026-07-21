import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // The Next.js tsconfig sets jsx="preserve", which esbuild alone won't transform; the React
  // plugin compiles JSX/TSX so component tests (tests/*.test.tsx) can render.
  plugins: [react()],
  test: {
    environment: "node",
    globalSetup: "./tests/global-setup.ts",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
