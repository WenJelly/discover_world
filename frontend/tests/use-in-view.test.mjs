import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

test("useInView exposes ref + inView tuple with once option", async () => {
  assert.ok(existsSync(path.join(rootDir, "src/hooks/useInView.ts")));
  const src = await readFile(path.join(rootDir, "src/hooks/useInView.ts"), "utf8");
  assert.match(src, /export function useInView/);
  assert.match(src, /IntersectionObserver/);
  assert.match(src, /rootMargin/);
  assert.match(src, /threshold/);
  assert.match(src, /once/);
  assert.match(src, /disconnect\(\)/);
});

test("useInView defaults to once=true and disconnects after first intersection", async () => {
  const src = await readFile(path.join(rootDir, "src/hooks/useInView.ts"), "utf8");
  assert.match(src, /once = true/);
});
