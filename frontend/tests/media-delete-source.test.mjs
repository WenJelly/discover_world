import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account media delete retries with force only after dynamic reference confirmation", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /isForceDeleteMediaConflict\(error\.code,\s*error\.message\)/);
  assert.match(source, /deleteMediaAsset\(\s*confirmation\.imageId,\s*confirmation\.mode === "force"\s*\? \{\s*force:\s*true\s*\}/);
});

test("account media delete uses in-app confirmation and Sonner feedback", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /window\.confirm|window\.alert|\balert\(/);
  assert.match(source, /deleteConfirmation/);
  assert.match(source, /setDeleteConfirmation/);
  assert.match(source, /DialogTitle[\s\S]*删除图片/);
  assert.match(source, /DialogDescription[\s\S]*此操作无法撤销/);
  assert.match(source, /import \{ toast as sonner \} from "sonner"/);
  assert.match(source, /sonner\.error\("删除失败"/);
});
