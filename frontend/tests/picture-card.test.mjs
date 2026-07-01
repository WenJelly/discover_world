import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("PictureCard renders thumbnail with lazy loading and picColor fallback", async () => {
  assert.ok(existsSync(path.join(rootDir, "src/components/home/PictureCard.tsx")));
  const src = await readFile(
    path.join(rootDir, "src/components/home/PictureCard.tsx"),
    "utf8"
  );
  assert.match(src, /export (default function|const) PictureCard/);
  assert.match(src, /thumbnailUrl/);
  assert.match(src, /loading="lazy"/);
  assert.match(src, /decoding="async"/);
  assert.match(src, /picColor/);
  assert.match(src, /ImageOff/);
});

test("PictureCard renders author overlay when user is present", async () => {
  const src = await readFile(
    path.join(rootDir, "src/components/home/PictureCard.tsx"),
    "utf8"
  );
  assert.match(src, /user\.userName/);
  assert.match(src, /user\.userAvatar/);
  assert.match(src, /user\s*&&/);
});

test("PictureCard renders tags when non-empty", async () => {
  const src = await readFile(
    path.join(rootDir, "src/components/home/PictureCard.tsx"),
    "utf8"
  );
  assert.match(src, /tags\.length/);
  assert.match(src, /tags\./);
});

test("PictureCard shows view and like counts", async () => {
  const src = await readFile(
    path.join(rootDir, "src/components/home/PictureCard.tsx"),
    "utf8"
  );
  assert.match(src, /viewCount/);
  assert.match(src, /likeCount/);
});
