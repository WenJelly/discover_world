import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend posts media downloads through the backend counting endpoint", async () => {
  const api = await readFile(
    new URL("../src/lib/api.ts", import.meta.url),
    "utf8"
  );
  const types = await readFile(
    new URL("../src/lib/types.ts", import.meta.url),
    "utf8"
  );

  assert.match(types, /export interface DownloadMediaAssetRequest/);
  assert.match(types, /export interface MediaAssetDownloadResponse/);
  assert.match(types, /url: string/);
  assert.match(types, /stats: MediaAssetStats/);

  assert.match(api, /export async function downloadMediaAsset/);
  assert.match(api, /"\/api\/media\/download"/);
  assert.match(api, /requireAuth: true/);
  assert.match(api, /normalizeMediaStats/);
});

test("photo detail download uses backend stats instead of local-only increments", async () => {
  const dialog = await readFile(
    new URL("../src/components/photo/PhotoDetailDialog.tsx", import.meta.url),
    "utf8"
  );
  const button = await readFile(
    new URL("../src/components/photo/DownloadButton.tsx", import.meta.url),
    "utf8"
  );

  assert.match(dialog, /downloadMediaAsset/);
  assert.match(dialog, /const handleDownloadRequest = async \(\) =>/);
  assert.match(dialog, /await downloadMediaAsset\(\{\s*id:\s*media\.id/);
  assert.match(dialog, /setStats\(res\.stats\)/);
  assert.match(dialog, /onDownloadRequest=\{handleDownloadRequest\}/);
  assert.doesNotMatch(dialog, /downloadCount: current\.downloadCount \+ 1/);

  assert.match(button, /onDownloadRequest\?: \(\) => Promise<MediaAssetDownloadResponse>/);
  assert.match(button, /\(!url && !onDownloadRequest\) \|\| !canDownload \|\| loading/);
  assert.match(button, /const res = await onDownloadRequest\(\)/);
  assert.match(button, /downloadAsset\(res\.url/);
});
