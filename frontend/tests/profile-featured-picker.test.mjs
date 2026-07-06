import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media picker supports owner filter and managed pre-selection", async () => {
  const source = await readFile(
    new URL("../src/components/admin/MediaPickerDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /ownerUserId\?: string/);
  assert.match(source, /initialSelected\?: MediaAssetResponse\[\]/);
  assert.match(source, /ownerUserId,\s*\n\s*variantOption/);
  assert.match(source, /initialSelectedRef/);
  assert.match(source, /selected\.size === 0 && !isManaged/);
  assert.match(source, /result === false/);
});

test("account featured tab exposes management entry for owner", async () => {
  const source = await readFile(
    new URL("../src/pages/AccountDetailPage.tsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /MAX_FEATURED_COUNT = 20/);
  assert.match(source, /MediaPickerDialog/);
  assert.match(source, /updateProfileFeaturedMedia/);
  assert.match(source, /setShowFeaturedPicker\(true\)/);
  assert.match(source, /initialSelected=\{featuredAssets\}/);
  assert.match(source, /maxCount=\{MAX_FEATURED_COUNT\}/);
  assert.match(source, /ownerUserId=\{user\?\.id\}/);
});
