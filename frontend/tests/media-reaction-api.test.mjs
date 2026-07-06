import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media reaction and detail API wrappers match the backend contract", async () => {
  const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(types, /export interface MediaAssetToggleResponse/);
  assert.match(types, /export interface ToggleMediaReactionRequest/);
  assert.match(types, /reactionType\?: string/);

  assert.match(api, /MediaAssetToggleResponse/);
  assert.match(api, /ToggleMediaReactionRequest/);
  assert.match(api, /export async function fetchMediaAssetDetail/);
  assert.match(api, /"\/api\/media\/detail"/);
  assert.match(api, /fetchMediaAssetDetail[\s\S]*requireAuth:\s*true/);
  assert.match(api, /fetchMediaAssetDetail[\s\S]*normalizeMediaAsset\(resp\)/);

  assert.match(api, /export async function toggleMediaReaction/);
  assert.match(api, /"\/api\/media\/reaction\/toggle"/);
  assert.match(api, /toggleMediaReaction[\s\S]*reactionType:\s*req\.reactionType\s*\?\?\s*"like"/);
  assert.match(api, /toggleMediaReaction[\s\S]*requireAuth:\s*true/);
});

test("media asset normalization preserves viewer liked state for UI rendering", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(api, /isLiked:\s*asset\.isLiked\s*\?\?\s*false/);
  assert.match(api, /likeCount:\s*stats\.reactionCount\s*\?\?\s*asset\.likeCount\s*\?\?\s*0/);
});
