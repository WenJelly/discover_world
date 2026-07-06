import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account media delete retries with force only after dynamic reference confirmation", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /isForceDeleteMediaConflict\(error\.code,\s*error\.message\)/);
  assert.match(source, /deleteMediaAsset\(imageId,\s*\{\s*force:\s*true\s*\}\)/);
});
