import assert from "node:assert/strict";
import test from "node:test";

import { normalizeApiErrorMessage } from "../src/lib/api-error.ts";

test("normalizes upload deadline errors to a helpful retry message", () => {
  assert.equal(
    normalizeApiErrorMessage(
      'Put "https://example.com/image.jpg": context deadline exceeded',
      "upload"
    ),
    "图片上传超时，请检查网络后重试；如果图片较大，可以先压缩后再上传。"
  );
});

test("normalizes object storage failures without exposing provider jargon", () => {
  assert.equal(
    normalizeApiErrorMessage("上传 COS 失败", "upload"),
    "图片上传到存储服务失败，请稍后重试。"
  );
});

test("keeps actionable validation messages unchanged", () => {
  assert.equal(
    normalizeApiErrorMessage("图片大小不能超过 30MB", "upload"),
    "图片大小不能超过 30MB"
  );
});
