import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminTabHref,
  parseAdminLogId,
  parseAdminTab,
  type AdminTab,
} from "../src/lib/admin-navigation.ts";

test("admin tab query values are normalized", () => {
  const cases: Array<[string | null, AdminTab]> = [
    [null, "dashboard"],
    ["dashboard", "dashboard"],
    ["homepage", "homepage"],
    ["media-review", "media-review"],
    ["reports", "reports"],
    ["moderation", "moderation"],
    ["tags", "tags"],
    ["audit", "audit"],
    ["unknown", "dashboard"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(parseAdminTab(value), expected);
  }
});

test("admin log ids are trimmed and empty values are discarded", () => {
  assert.equal(parseAdminLogId(null), "");
  assert.equal(parseAdminLogId("  "), "");
  assert.equal(parseAdminLogId(" 123 "), "123");
});

test("admin tab links use canonical query values", () => {
  assert.equal(buildAdminTabHref("reports"), "/admin?tab=reports");
  assert.equal(
    buildAdminTabHref("audit", { logId: "123" }),
    "/admin?tab=audit&logId=123"
  );
  assert.equal(buildAdminTabHref("tags", { logId: "123" }), "/admin?tab=tags");
});
