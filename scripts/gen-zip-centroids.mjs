// Regenerates lib/zip-centroids.json — a compact ZIP → [lat, lng] table used server-side to
// answer "is this delivery ZIP within N miles of the yard" without any geocoding API.
//
// Source: the `zipcodes` npm package (devDependency, MIT). We keep only US entries with real
// coordinates and round to 4 decimals (~11 m), which is far finer than ZIP-centroid distance
// needs. Run with:  node scripts/gen-zip-centroids.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { codes } = require("zipcodes/lib/codes.js");

const out = {};
let skipped = 0;
for (const zip of Object.keys(codes)) {
  const e = codes[zip];
  if (e.country !== "US") continue;
  const lat = e.latitude;
  const lng = e.longitude;
  // Drop rows with missing or null-island (0,0) coordinates — they'd match nothing sanely.
  if (typeof lat !== "number" || typeof lng !== "number" || (lat === 0 && lng === 0)) {
    skipped++;
    continue;
  }
  out[zip] = [Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4];
}

const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "zip-centroids.json");
// One ZIP per line keeps the diff readable and the file greppable without bloating it much.
const body = Object.keys(out)
  .sort()
  .map((z) => `${JSON.stringify(z)}:${JSON.stringify(out[z])}`)
  .join(",\n");
writeFileSync(dest, `{\n${body}\n}\n`);

console.log(`wrote ${Object.keys(out).length} US ZIP centroids (${skipped} skipped) → ${dest}`);
