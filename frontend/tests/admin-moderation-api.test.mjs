import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

test("admin moderation API exposes report and content workflows", () => {
  for (const token of [
    '"/api/admin/moderation/report/list"',
    '"/api/admin/moderation/report/detail"',
    '"/api/admin/moderation/report/resolve"',
    '"/api/admin/moderation/content/list"',
    '"/api/admin/moderation/comment/hide"',
    '"/api/admin/moderation/comment/restore"',
    "fetchAdminModerationReportList",
    "fetchAdminModerationReportDetail",
    "resolveAdminModerationReport",
    "fetchAdminContentList",
    "adminHideComment",
    "adminRestoreComment",
  ]) {
    assert.ok(api.includes(token), `missing ${token}`);
  }
});

test("admin moderation types preserve ids and audit context", () => {
  for (const token of [
    "AdminModerationReportQueryRequest",
    "AdminModerationReportResolveRequest",
    "AdminModerationReportResponse",
    "AdminModerationReportPageResponse",
    "AdminContentQueryRequest",
    "AdminContentResponse",
    "AdminContentPageResponse",
    "reportId?: string",
    "reason?: string",
  ]) {
    assert.ok(types.includes(token), `missing ${token}`);
  }
});
