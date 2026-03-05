import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const BUCKET = "wilds-assets";
const ASSETS_DIR = "assets";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json",
};

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

const files = walk(ASSETS_DIR);

if (files.length === 0) {
  console.log("No files in assets/ to sync.");
  process.exit(0);
}

console.log(`Syncing ${files.length} file(s) to R2 bucket "${BUCKET}"...\n`);

for (const file of files) {
  const key = relative(ASSETS_DIR, file);
  const ext = extname(file).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  console.log(`  ${key} (${contentType})`);

  execSync(
    `npx wrangler r2 object put "${BUCKET}/${key}" --file "${file}" --content-type "${contentType}" --remote`,
    { stdio: "inherit" }
  );
}

console.log("\nDone.");
