#!/usr/bin/env node
// Sync all files in .images/ to the R2 bucket.
// Usage: node scripts/r2-sync.mjs [--remote]

import { readdirSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const BUCKET = "besthope-blog";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const IMAGES_DIR = join(ROOT, ".images");
const isRemote = process.argv.includes("--remote");
const remoteFlag = isRemote ? "--remote" : "";

console.log(`Syncing .images/ → r2://${BUCKET} (${isRemote ? "remote" : "local"})\n`);

let uploaded = 0;
let failed = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else {
      const key = relative(IMAGES_DIR, fullPath).replace(/\\/g, "/");
      try {
        console.log(`Uploading ${key}...`);
        execSync(
          `wrangler r2 object put "${BUCKET}/${key}" --file "${fullPath}" ${remoteFlag}`,
          { stdio: "inherit" },
        );
        console.log(`  ✓ ${key}`);
        uploaded++;
      } catch {
        console.error(`  ✗ ${key}`);
        failed++;
      }
    }
  }
}

walk(IMAGES_DIR);

console.log(`\n${uploaded} uploaded${failed ? `, ${failed} failed` : ""}.`);
if (failed) process.exit(1);
