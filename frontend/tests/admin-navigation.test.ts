import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminTabHref,
  parseAdminTab,
  type AdminTab,
} from "../src/lib/admin-navigation.ts";

test("admin tab query values are normalized", () => {
  const cases: Array<[string | null, AdminTab]> = [
    [null, "homepage"],
    ["homepage", "homepage"],
    ["media-review", "media-review"],
    ["reports", "reports"],
    ["moderation", "moderation"],
    ["unknown", "homepage"],
  ];

  for (const [value, expected] of cases) {
    assert.equal(parseAdminTab(value), expected);
  }
});

test("admin tab links use canonical query values", () => {
  assert.equal(buildAdminTabHref("reports"), "/admin?tab=reports");
});
