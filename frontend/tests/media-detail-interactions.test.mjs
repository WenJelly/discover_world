import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media detail dialog loads real detail stats and toggles backend likes", async () => {
  const dialog = await readFile(
    new URL("../src/components/discover/MediaDetailDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(dialog, /fetchMediaAssetDetail/);
  assert.match(dialog, /toggleMediaReaction/);
  assert.match(dialog, /useAuth/);
  assert.match(dialog, /onAssetChange\?: \(asset: MediaAssetResponse\) => void/);
  assert.match(dialog, /setLiked\(Boolean\(asset\.isLiked\)\)/);
  assert.match(dialog, /setStats\(asset\.stats\)/);
  assert.match(dialog, /fetchMediaAssetDetail\(\{\s*id:\s*(asset\.id|assetId)/);
  assert.match(dialog, /onAssetChange\?\.\(detail\)/);
  assert.match(dialog, /await toggleMediaReaction\(\{\s*id:\s*asset\.id/);
  assert.match(dialog, /onAssetChange\?\.\(\{\s*\.\.\.asset,[\s\S]*isLiked:\s*res\.active/);
  assert.doesNotMatch(dialog, /UI-only|TODO: persist/);
});

test("discover page stores updated media stats for cards and the open dialog", async () => {
  const page = await readFile(
    new URL("../src/pages/DiscoverPage.tsx", import.meta.url),
    "utf8"
  );
  const card = await readFile(
    new URL("../src/components/discover/DiscoverPictureCard.tsx", import.meta.url),
    "utf8"
  );

  assert.match(page, /assetOverrides/);
  assert.match(page, /setAssetOverrides/);
  assert.match(page, /pictures\.map\(\(picture\) =>/);
  assert.match(page, /assetOverrides\[picture\.id\]/);
  assert.match(page, /onAssetChange=\{handleAssetChange\}/);

  assert.match(card, /picture\.isLiked/);
  assert.match(card, /fill-current/);
});
