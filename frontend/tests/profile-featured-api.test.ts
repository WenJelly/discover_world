import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("profile featured media update API wrapper is available", async () => {
  const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(types, /export interface UpdateProfileFeaturedMediaReq/);
  assert.match(types, /mediaAssetIds\?: string\[\]/);
  assert.match(api, /UpdateProfileFeaturedMediaReq/);
  assert.match(api, /export async function updateProfileFeaturedMedia/);
  assert.match(api, /"\/api\/profile\/featured\/media\/update"/);
  assert.match(api, /normalizeMediaAssetPage/);
});
