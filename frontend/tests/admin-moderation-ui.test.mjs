import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("admin shell uses shadcn Sidebar and canonical tab links", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const page = await source("../src/pages/AdminPage.tsx");

  for (const token of [
    "Sidebar",
    "SidebarContent",
    "SidebarMenuButton",
    "首页配置",
    "媒体审核",
    "举报工单",
    "内容治理",
    "buildAdminTabHref",
  ]) {
    assert.ok(sidebar.includes(token), `missing ${token}`);
  }

  for (const token of [
    "SidebarProvider",
    "SidebarInset",
    "SidebarTrigger",
    "parseAdminTab",
    "window.location.search",
  ]) {
    assert.ok(page.includes(token), `missing ${token}`);
  }
});

test("report panel supports filters detail and resolution", async () => {
  const report = await source("../src/components/admin/AdminReportsPanel.tsx");

  for (const token of [
    "fetchAdminModerationReportList",
    "fetchAdminModerationReportDetail",
    "resolveAdminModerationReport",
    'status: "open"',
    "reporterUserId",
    "targetId",
    "createdAtFrom",
    "createdAtTo",
    "accepted",
    "rejected",
    "resolved",
    "hide_post",
    "restore_post",
    "hide_comment",
    "restore_comment",
    "lock_forum_post",
    "unlock_forum_post",
    "处理说明",
  ]) {
    assert.ok(report.includes(token), `missing ${token}`);
  }
});
