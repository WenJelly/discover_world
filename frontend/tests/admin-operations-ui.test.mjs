import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AdminPage delegates homepage and media review business logic", async () => {
  const page = await source("../src/pages/AdminPage.tsx");
  const homepage = await source(
    "../src/components/admin/AdminHomepagePanel.tsx"
  );
  const media = await source(
    "../src/components/admin/AdminMediaReviewPanel.tsx"
  );

  assert.ok(page.includes("AdminHomepagePanel"));
  assert.ok(page.includes("AdminMediaReviewPanel"));
  assert.ok(!page.includes("fetchHomepageConfig"));
  assert.ok(!page.includes("fetchAdminMediaAssetList"));
  assert.ok(!page.includes("reviewMediaAsset"));

  for (const token of [
    "fetchHomepageConfig",
    "updateHomepageHero",
    "updateHomepageFeatured",
    "MediaPickerDialog",
    "MAX_FEATURED_COUNT",
  ]) {
    assert.ok(homepage.includes(token), `homepage missing ${token}`);
  }

  for (const token of [
    "fetchAdminMediaAssetList",
    "reviewMediaAsset",
    "mediaReviewMessage",
    "pendingMedia",
  ]) {
    assert.ok(media.includes(token), `media review missing ${token}`);
  }
});
