import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildMediaAssetDirectUploadInitRequest,
  isSupportedUploadImageFile,
  MEDIA_UPLOAD_ACCEPT,
} from "../src/lib/media-upload.ts";
import { shouldDisplayUploadedMediaAsset } from "../src/lib/media-events.ts";

test("buildMediaAssetDirectUploadInitRequest sends file facts and cleaned metadata", () => {
  const file = new File(["image"], "mountain-view.jpeg", { type: "image/jpeg" });

  const request = buildMediaAssetDirectUploadInitRequest(
    file,
    {
      title: "  ",
      description: " Ridge line ",
      category: " 风景 ",
      tags: [" 山 ", "", "云"],
      visibility: "private",
      assetUsage: "post",
    },
    {
      width: 1600,
      height: 900,
    }
  );

  assert.deepEqual(request, {
    fileName: "mountain-view.jpeg",
    fileSize: file.size,
    contentType: "image/jpeg",
    title: "mountain-view",
    description: "Ridge line",
    category: "风景",
    tags: ["山", "云"],
    visibility: "private",
    assetUsage: "post",
    width: 1600,
    height: 900,
  });
});

test("frontend file pickers only accept image formats supported by direct upload", () => {
  assert.equal(
    MEDIA_UPLOAD_ACCEPT,
    ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
  );
  assert.equal(
    isSupportedUploadImageFile(
      new File(["jpg"], "photo.jpg", { type: "image/jpeg" })
    ),
    true
  );
  assert.equal(
    isSupportedUploadImageFile(
      new File(["webp"], "photo.webp", { type: "image/webp" })
    ),
    true
  );
  assert.equal(
    isSupportedUploadImageFile(
      new File(["gif"], "photo.gif", { type: "image/gif" })
    ),
    false
  );
});

test("URL upload UI explains browser CORS requirements", async () => {
  const dialog = await readFile(
    new URL("../src/components/upload/UploadDialog.tsx", import.meta.url),
    "utf8"
  );

  assert.match(dialog, /图片来源需允许浏览器跨域读取/);
  assert.doesNotMatch(dialog, /JPG \/ PNG \/ GIF \/ WebP/);
});

test("media file upload remains frontend direct upload without server fallback", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(api, /"\/api\/media\/upload\/direct\/init"/);
  assert.match(api, /const eTag = await uploadDirectObject\(file, upload\)/);
  assert.match(api, /"\/api\/media\/upload\/direct\/complete"/);
  assert.doesNotMatch(api, /function shouldUseDirectObjectUpload\(\)/);
  assert.doesNotMatch(api, /async function uploadMediaAssetViaServer/);
  assert.doesNotMatch(api, /return uploadMediaAssetViaServer\(file, metadata\)/);
});

test("avatar upload uses direct object storage before binding the asset", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(api, /const asset = await uploadMediaAsset\(file,\s*\{[\s\S]*assetUsage:\s*"avatar"/);
  assert.match(api, /"\/api\/account\/avatar\/set"/);
  assert.match(api, /assetId:\s*asset\.id/);
  assert.doesNotMatch(api, /"\/api\/account\/avatar\/upload"/);
  assert.doesNotMatch(api, /buildAccountAvatarUploadFormData/);
});

test("URL import downloads in the browser and reuses direct object upload", async () => {
  const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  assert.match(api, /export async function uploadMediaAssetByUrl/);
  assert.match(api, /await fetch\(normalizedUrl/);
  assert.match(api, /return uploadMediaAsset\(file, metadata\)/);
  assert.doesNotMatch(api, /"\/api\/media\/upload\/url"/);
  assert.doesNotMatch(api, /buildMediaAssetUrlUploadRequest/);
});

test("shouldDisplayUploadedMediaAsset matches public gallery visibility rules", () => {
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "active",
      visibility: "public",
      auditStatus: "approved",
      assetUsage: "work",
    } as any),
    true
  );
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "active",
      visibility: "public",
      auditStatus: "approved",
      assetUsage: "post",
    } as any),
    false
  );
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "active",
      visibility: "public",
      auditStatus: "pending",
    } as any),
    false
  );
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "uploading",
      visibility: "public",
      auditStatus: "approved",
    } as any),
    false
  );
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "active",
      visibility: "private",
      auditStatus: "approved",
    } as any),
    false
  );
});
