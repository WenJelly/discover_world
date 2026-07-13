import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("AdminPage delegates homepage and media review business logic", async () => {
  const page = await source("../src/pages/AdminPage.tsx");
  const homepage = await source(
    "../src/components/admin/AdminHomepagePanel.tsx"
  );
  const media = await source(
    "../src/components/admin/AdminMediaReviewPanel.tsx"
  );

  assert.ok(page.includes("AdminHomepagePanel"));
  assert.ok(page.includes("AdminMediaReviewPanel"));
  assert.ok(!page.includes("fetchHomepageConfig"));
  assert.ok(!page.includes("fetchAdminMediaAssetList"));
  assert.ok(!page.includes("reviewMediaAsset"));

  for (const token of [
    "fetchHomepageConfig",
    "updateHomepageHero",
    "updateHomepageFeatured",
    "MediaPickerDialog",
    "MAX_FEATURED_COUNT",
  ]) {
    assert.ok(homepage.includes(token), `homepage missing ${token}`);
  }

  for (const token of [
    "fetchAdminMediaAssetList",
    "reviewMediaAsset",
    "mediaReviewMessage",
    "pendingMedia",
  ]) {
    assert.ok(media.includes(token), `media review missing ${token}`);
  }
});

test("admin sidebar groups dashboard and content workspaces", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  for (const token of [
    "数据概览",
    "内容管理",
    "首页配置",
    "媒体审核",
    "举报工单",
    "内容治理",
  ]) {
    assert.ok(sidebar.includes(token), `sidebar missing ${token}`);
  }
});

test("admin dashboard shows real metrics queue links and recent operations", async () => {
  const dashboard = await source(
    "../src/components/admin/AdminDashboardPanel.tsx"
  );
  for (const token of [
    "fetchAdminDashboard",
    "fetchAdminOperationLogList",
    "pendingMediaCount",
    "openReportCount",
    "activeUserCount",
    "publicMediaCount",
    "publicPostCount",
    "最近操作",
    "查看全部操作日志",
  ]) {
    assert.ok(dashboard.includes(token), `dashboard missing ${token}`);
  }
  for (const token of [
    "recentMediaCount",
    "recentPostCount",
    "recentReportCount",
  ]) {
    assert.ok(!dashboard.includes(token), `dashboard must not render ${token}`);
  }
});

test("tag management supports explicit status edit and merge workflows", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const tags = await source(
    "../src/components/admin/AdminTagManagementPanel.tsx"
  );
  for (const token of [
    "fetchAdminTagList",
    "updateAdminTag",
    "mergeAdminTag",
    "status: 1",
    "修改原因",
    "合并原因",
    "源标签",
    "目标标签",
    "标签关联将迁移",
    "pageSize: PAGE_SIZE",
    "next.status !== filters.status",
  ]) {
    assert.ok(tags.includes(token), `tag management missing ${token}`);
  }
  assert.ok(sidebar.includes("运营管理"));
  assert.ok(sidebar.includes("标签管理"));
  assert.ok(!tags.includes("全部状态"));
});

test("operation audit supports filters deep links and safe JSON sections", async () => {
  const sidebar = await source("../src/components/admin/AdminSidebar.tsx");
  const audit = await source("../src/components/admin/AdminAuditPanel.tsx");
  assert.ok(sidebar.includes("操作审计"));
  for (const token of [
    "fetchAdminOperationLogList",
    "fetchAdminOperationLogDetail",
    "operatorUserId",
    "targetType",
    "targetId",
    "createdAtFrom",
    "createdAtTo",
    "formatAdminOperationJson",
    "Before",
    "After",
    "Metadata",
    "clientIp",
    "onSelectedIdChange",
  ]) {
    assert.ok(audit.includes(token), `audit panel missing ${token}`);
  }
});
