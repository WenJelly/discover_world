import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const types = await readFile(new URL("../src/lib/types.ts", import.meta.url), "utf8");

test("admin operations API exposes dashboard tags and audit workflows", () => {
  for (const token of [
    '"/api/admin/operation/dashboard"',
    '"/api/admin/operation/tag/list"',
    '"/api/admin/operation/tag/update"',
    '"/api/admin/operation/tag/merge"',
    '"/api/admin/audit/operation/list"',
    '"/api/admin/audit/operation/detail"',
    "fetchAdminDashboard",
    "fetchAdminTagList",
    "updateAdminTag",
    "mergeAdminTag",
    "fetchAdminOperationLogList",
    "fetchAdminOperationLogDetail",
  ]) {
    assert.ok(api.includes(token), `missing ${token}`);
  }
});

test("admin operations types preserve ids status and JSON snapshots", () => {
  for (const token of [
    "AdminDashboardResponse",
    "pendingMediaCount: number",
    "openReportCount: number",
    "AdminTagQueryRequest",
    "status?: number",
    "AdminTagUpdateRequest",
    "sourceTagId: string",
    "targetTagId: string",
    "AdminOperationLogQueryRequest",
    "operatorUserId?: string",
    "beforeJson: string",
    "afterJson: string",
    "metadataJson: string",
    "clientIp: string",
  ]) {
    assert.ok(types.includes(token), `missing ${token}`);
  }
});
