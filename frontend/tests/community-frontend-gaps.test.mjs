import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

function containsAll(text, fragments) {
  for (const fragment of fragments) {
    assert.match(
      text,
      new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    );
  }
}

test("api wrappers cover comments reports pinning moderation and media review", async () => {
  const [api, types] = await Promise.all([
    source("../src/lib/api.ts"),
    source("../src/lib/types.ts"),
  ]);

  containsAll(types, [
    "PostCommentResponse",
    "PostCommentCursorPageResponse",
    "CreatePostCommentRequest",
    "CreateModerationReportRequest",
    "ModerationReportResponse",
    "ReviewMediaAssetRequest",
    "AdminQueryMediaAssetRequest",
    "AdminModeratePostRequest",
  ]);

  containsAll(api, [
    "fetchPostDetail",
    '"/api/post/detail"',
    "pinPost",
    '"/api/post/pin"',
    "unpinPost",
    '"/api/post/unpin"',
    "fetchPostCommentCursorList",
    '"/api/post/comment/list/cursor"',
    "createPostComment",
    '"/api/post/comment/create"',
    "createModerationReport",
    '"/api/moderation/report/create"',
    "fetchAdminMediaAssetList",
    '"/api/admin/media/list"',
    "reviewMediaAsset",
    '"/api/media/review"',
    "adminHidePost",
    '"/api/admin/moderation/post/hide"',
    "adminRestorePost",
    '"/api/admin/moderation/post/restore"',
    "adminLockForumPost",
    '"/api/admin/forum/post/lock"',
    "adminUnlockForumPost",
    '"/api/admin/forum/post/unlock"',
    "adminPinForumPost",
    '"/api/admin/forum/post/pin"',
    "adminUnpinForumPost",
    '"/api/admin/forum/post/unpin"',
  ]);
});

test("post card exposes comments reporting and post pin controls", async () => {
  const postCard = await source("../src/components/post/PostCard.tsx");

  containsAll(postCard, [
    "fetchPostCommentCursorList",
    "createPostComment",
    "createModerationReport",
    "pinPost",
    "unpinPost",
    "aria-label=\"评论动态\"",
    "举报动态",
    "举报评论",
    "targetType: \"post\"",
    "targetType: \"comment_record\"",
    "置顶动态",
    "取消置顶",
  ]);

  assert.doesNotMatch(postCard, /评论功能即将上线/);
});

test("admin workspace has media review reports and complete content governance", async () => {
  const adminPage = await source("../src/pages/AdminPage.tsx");
  const reports = await source(
    "../src/components/admin/AdminReportsPanel.tsx"
  );
  const content = await source(
    "../src/components/admin/AdminContentModerationPanel.tsx"
  );
  const forum = await source(
    "../src/components/admin/AdminForumModerationPanel.tsx"
  );

  containsAll(adminPage, [
    "fetchAdminMediaAssetList",
    "reviewMediaAsset",
    "AdminReportsPanel",
    "AdminContentModerationPanel",
    "首页配置",
    "媒体审核",
    "举报工单",
    "内容治理",
    "通过",
    "拒绝",
  ]);

  containsAll(reports, [
    "fetchAdminModerationReportList",
    "fetchAdminModerationReportDetail",
    "resolveAdminModerationReport",
    "提交处理结果",
  ]);

  containsAll(content, [
    "fetchAdminContentList",
    "adminHidePost",
    "adminRestorePost",
    "adminHideComment",
    "adminRestoreComment",
    "动态与评论",
    "隐藏内容",
    "恢复内容",
  ]);

  containsAll(forum, [
    "fetchForumPostCursorList",
    "adminLockForumPost",
    "adminUnlockForumPost",
    "adminPinForumPost",
    "adminUnpinForumPost",
    "锁定帖子",
    "分区置顶",
  ]);

  assert.doesNotMatch(content, /fetchPublicPostCursorList/);
});

test("community page supports public filtering forum detail images and admin forum actions", async () => {
  const community = await source("../src/pages/CommunityPage.tsx");

  containsAll(community, [
    "publicSort",
    "publicSearchText",
    "setPublicSearchText",
    "author?.avatarUrl || author?.userAvatar || \"\"",
    "sort: publicSort",
    "searchText: publicSearchText",
    "fetchPostDetail",
    "selectedPostId",
    "PostImageAttach",
    "uploadMediaAsset",
    "imageIds",
    "adminLockForumPost",
    "adminUnlockForumPost",
    "adminPinForumPost",
    "adminUnpinForumPost",
    "查看详情",
  ]);
});

test("notifications have a center page pagination and target navigation", async () => {
  const centerUrl = new URL("../src/pages/NotificationsPage.tsx", import.meta.url);
  assert.equal(existsSync(centerUrl), true);

  const [appLayout, bell, center] = await Promise.all([
    source("../src/app/AppLayout.tsx"),
    source("../src/components/notifications/NotificationBell.tsx"),
    source("../src/pages/NotificationsPage.tsx"),
  ]);

  containsAll(appLayout, [
    "NotificationsPage",
    "pathname === \"/notifications\"",
    "<NotificationsPage />",
  ]);

  containsAll(bell, [
    "getNotificationTargetHref",
    "navigateNotificationTarget",
    "查看全部通知",
    "/notifications",
  ]);

  containsAll(center, [
    "fetchNotificationCursorList",
    "markNotificationRead",
    "markAllNotificationsRead",
    "getNotificationTargetHref",
    "hasMore",
    "加载更多",
  ]);
});

test("profile page exposes follow lists and honest album management affordances", async () => {
  const account = await source("../src/pages/AccountDetailPage.tsx");

  containsAll(account, [
    "fetchFollowerList",
    "fetchFollowingList",
    "FollowListDialog",
    "openFollowList",
    "粉丝列表",
    "关注列表",
    "AlbumManagerDialog",
    "创建相册",
    "编辑相册",
    "删除相册",
    "添加作品",
    "后端相册管理接口尚未开放",
  ]);
});
