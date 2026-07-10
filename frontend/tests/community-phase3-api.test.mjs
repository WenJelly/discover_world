import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiUrl = new URL("../src/lib/api.ts", import.meta.url);
const typesUrl = new URL("../src/lib/types.ts", import.meta.url);

test("community phase 3 api wrappers call the backend endpoints", async () => {
  const api = await readFile(apiUrl, "utf8");

  for (const fragment of [
    "fetchPublicPostCursorList",
    '"/api/post/public/list/cursor"',
    "fetchForumBoardList",
    '"/api/forum/board/list"',
    "fetchForumPostCursorList",
    '"/api/forum/post/list/cursor"',
    "createForumPost",
    '"/api/forum/post/create"',
    "fetchFollowingPostCursorList",
    '"/api/feed/following/post/list/cursor"',
    "fetchFollowingMediaCursorList",
    '"/api/feed/following/media/list/cursor"',
    "fetchNotificationCursorList",
    '"/api/notification/list/cursor"',
    "fetchUnreadNotificationCount",
    '"/api/notification/unread/count"',
    "markNotificationRead",
    '"/api/notification/read"',
    "markAllNotificationsRead",
    '"/api/notification/read/all"',
  ]) {
    assert.match(api, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(api, /normalizePublicPostPage/);
  assert.match(api, /postType: normalizePostType\(post\.postType\)/);
  assert.match(api, /normalizeForumPostPage/);
  assert.match(api, /normalizeNotificationPage/);
});

test("community phase 3 types describe posts forums notifications and feeds", async () => {
  const types = await readFile(typesUrl, "utf8");

  for (const fragment of [
    "PostType",
    "PublicPostResponse",
    "PublicPostCursorPageResponse",
    "PublicPostListReq",
    "ForumBoardResponse",
    "ForumBoardListResponse",
    "ForumPostResponse",
    "ForumPostCursorPageResponse",
    "CreateForumPostRequest",
    "FollowingPostListReq",
    "FollowingMediaListReq",
    "NotificationResponse",
    "NotificationCursorPageResponse",
    "UnreadNotificationCountResponse",
    "MarkNotificationReadRequest",
  ]) {
    assert.match(types, new RegExp(`interface ${fragment}|type ${fragment}`));
  }
  assert.match(types, /postType\?: PostType/);
  assert.match(types, /postType: PostType/);
});
