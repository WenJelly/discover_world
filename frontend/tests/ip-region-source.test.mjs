import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend models and normalizers preserve backend IP regions", async () => {
  const typesSource = await readFile(
    new URL("../src/lib/types.ts", import.meta.url),
    "utf8"
  );
  const apiSource = await readFile(
    new URL("../src/lib/api.ts", import.meta.url),
    "utf8"
  );

  assert.match(typesSource, /export interface IpRegionResponse \{/);
  assert.match(typesSource, /displayLocation: string/);
  assert.match(
    typesSource,
    /export interface MediaAssetResponse \{[\s\S]*ipRegion: IpRegionResponse;/
  );
  assert.match(
    typesSource,
    /export interface ProfilePostResponse \{[\s\S]*ipRegion: IpRegionResponse;/
  );
  for (const requestName of [
    "CreatePostRequest",
    "UpdatePostRequest",
    "CreateForumPostRequest",
  ]) {
    const requestSource =
      typesSource.match(
        new RegExp(`export interface ${requestName} \\{([\\s\\S]*?)\\n\\}`)
      )?.[0] ?? "";
    assert.notEqual(requestSource, "");
    assert.doesNotMatch(requestSource, /location\?: string;/);
  }

  assert.match(apiSource, /function normalizeIPRegion\(/);
  assert.match(apiSource, /ipRegion: normalizeIPRegion\(asset\.ipRegion\)/);
  assert.match(apiSource, /ipRegion: normalizeIPRegion\(post\.ipRegion\)/);
});

test("photo details display the media IP region without a static location", async () => {
  const source = await readFile(
    new URL("../src/components/photo/PhotoDetailDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /authorLocation\?: string/);
  assert.doesNotMatch(source, /authorLocation = REFERENCE_DETAIL_DEFAULTS\.authorLocation/);
  assert.doesNotMatch(source, /authorLocation: "中国 · 四川"/);
  assert.match(source, /location=\{media\.ipRegion\?\.displayLocation\}/);
});
