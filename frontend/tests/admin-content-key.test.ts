import assert from "node:assert/strict";
import test from "node:test";

import { getAdminContentKey } from "../src/lib/admin-moderation.ts";

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
