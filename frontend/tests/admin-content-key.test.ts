import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminContentKey,
  updateAdminContentStatus,
} from "../src/lib/admin-moderation.ts";

test("admin content keys separate post and comment ids", () => {
  assert.equal(getAdminContentKey("post", "42"), "post:42");
  assert.equal(
    getAdminContentKey("comment_record", "42"),
    "comment_record:42"
  );
  assert.notEqual(
    getAdminContentKey("post", "42"),
    getAdminContentKey("comment_record", "42")
  );
});

test("admin content status updates only the matching composite key", () => {
  const items = [
    { id: "42", targetType: "post", status: "active" },
    { id: "42", targetType: "comment_record", status: "active" },
  ];

  assert.deepEqual(updateAdminContentStatus(items, "post:42", "hidden"), [
    { id: "42", targetType: "post", status: "hidden" },
    { id: "42", targetType: "comment_record", status: "active" },
  ]);
});
