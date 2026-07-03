import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccountAvatarUploadFormData,
  buildMediaAssetUploadFormData,
  buildMediaAssetUrlUploadRequest,
} from "../src/lib/media-upload.ts";
import { shouldDisplayUploadedMediaAsset } from "../src/lib/media-events.ts";

test("buildMediaAssetUploadFormData includes the selected file and cleaned metadata", () => {
  const file = new File(["image"], "sunset-trip.jpg", { type: "image/jpeg" });

  const formData = buildMediaAssetUploadFormData(file, {
    title: "  ",
    description: " Golden hour ",
    category: " 旅行 ",
    tags: [" 海边 ", "", "日落"],
    visibility: "private",
  });

  assert.equal(formData.get("file"), file);
  assert.equal(formData.get("title"), "sunset-trip");
  assert.equal(formData.get("description"), "Golden hour");
  assert.equal(formData.get("category"), "旅行");
  assert.equal(formData.get("tags"), JSON.stringify(["海边", "日落"]));
  assert.equal(formData.get("visibility"), "private");
});

test("buildAccountAvatarUploadFormData only sends the avatar file to the account endpoint", () => {
  const file = new File(["avatar"], "avatar.png", { type: "image/png" });

  const formData = buildAccountAvatarUploadFormData(file);

  assert.equal(formData.get("file"), file);
  assert.deepEqual(Array.from(formData.keys()), ["file"]);
});

test("buildMediaAssetUrlUploadRequest trims and validates image URL uploads", () => {
  const request = buildMediaAssetUrlUploadRequest(" https://example.com/photos/night-city.png?size=lg ", {
    category: " 城市 ",
    tags: ["夜景", "  街道  "],
  });

  assert.deepEqual(request, {
    fileUrl: "https://example.com/photos/night-city.png?size=lg",
    title: "night-city",
    category: "城市",
    tags: ["夜景", "街道"],
    visibility: "public",
  });

  assert.throws(
    () => buildMediaAssetUrlUploadRequest("ftp://example.com/photo.jpg"),
    /仅支持 http 或 https 图片 URL/
  );
});

test("shouldDisplayUploadedMediaAsset matches public gallery visibility rules", () => {
  assert.equal(
    shouldDisplayUploadedMediaAsset({
      status: "active",
      visibility: "public",
      auditStatus: "approved",
    } as any),
    true
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
