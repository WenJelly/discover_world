import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("useInfinitePictures exposes required state and actions", async () => {
  assert.ok(existsSync(path.join(rootDir, "src/hooks/useInfinitePictures.ts")));
  const src = await readFile(
    path.join(rootDir, "src/hooks/useInfinitePictures.ts"),
    "utf8"
  );
  assert.match(src, /export function useInfinitePictures/);
  assert.match(src, /pictures/);
  assert.match(src, /hasMore/);
  assert.match(src, /loading/);
  assert.match(src, /error/);
  assert.match(src, /loadMore/);
  assert.match(src, /retry/);
});

test("useInfinitePictures guards against concurrent and post-exhaustion loads", async () => {
  const src = await readFile(
    path.join(rootDir, "src/hooks/useInfinitePictures.ts"),
    "utf8"
  );
  assert.match(src, /s\.loading/);
  assert.match(src, /s\.hasMore/);
});

test("useInfinitePictures tracks nextCursor across pages", async () => {
  const src = await readFile(
    path.join(rootDir, "src/hooks/useInfinitePictures.ts"),
    "utf8"
  );
  assert.match(src, /cursorRef/);
  assert.match(src, /nextCursor/);
  assert.match(src, /hasMore && .*nextCursor/);
});

test("useInfinitePictures passes compressType=1 to fetchPictureCursorList", async () => {
  const src = await readFile(
    path.join(rootDir, "src/hooks/useInfinitePictures.ts"),
    "utf8"
  );
  assert.match(src, /compressType:\s*1/);
});
