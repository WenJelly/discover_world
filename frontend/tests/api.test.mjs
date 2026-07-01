import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("api.ts exports ApiError and fetch-based client", async () => {
  assert.ok(existsSync(path.join(rootDir, "src/lib/api.ts")));
  const src = await readFile(path.join(rootDir, "src/lib/api.ts"), "utf8");
  assert.match(src, /export class ApiError/);
  assert.match(src, /VITE_API_BASE_URL|localhost:8888/);
  assert.match(src, /Authorization.*Bearer/);
  assert.match(src, /code !== 200|code === 200/);
  assert.match(src, /export function fetchPictureList/);
  assert.match(src, /export function fetchPictureCursorList/);
});

test("api.ts returns friendly message on network failure", async () => {
  const src = await readFile(path.join(rootDir, "src/lib/api.ts"), "utf8");
  assert.match(src, /服务暂时不可用/);
});

test("types.ts defines PictureResponse and cursor page types", async () => {
  const src = await readFile(path.join(rootDir, "src/lib/types.ts"), "utf8");
  assert.match(src, /export interface PictureResponse/);
  assert.match(src, /export interface PictureCursorPageResponse/);
  assert.match(src, /export interface UserDetail/);
  assert.match(src, /thumbnailUrl.*string/);
  assert.match(src, /nextCursor.*string/);
  assert.match(src, /hasMore.*boolean/);
});
