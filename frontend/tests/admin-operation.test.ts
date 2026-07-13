import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAdminOperationJson,
  getAdminOperationLabel,
} from "../src/lib/admin-operation.ts";

test("known admin operations use Chinese labels and unknown values stay visible", () => {
  assert.equal(getAdminOperationLabel("tag.update"), "更新标签");
  assert.equal(getAdminOperationLabel("moderation.report.resolve"), "处理举报");
  assert.equal(getAdminOperationLabel("forum_post.unpin"), "取消论坛置顶");
  assert.equal(getAdminOperationLabel("custom.action"), "custom.action");
  assert.equal(getAdminOperationLabel(""), "未知操作");
});

test("admin JSON formatting preserves parsed raw and empty values", () => {
  assert.deepEqual(formatAdminOperationJson('{"count":1}'), {
    kind: "json",
    text: '{\n  "count": 1\n}',
  });
  assert.deepEqual(formatAdminOperationJson("not-json"), {
    kind: "raw",
    text: "not-json",
  });
  assert.deepEqual(formatAdminOperationJson("  "), {
    kind: "empty",
    text: "无",
  });
});
