import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const communityPageUrl = new URL("../src/pages/CommunityPage.tsx", import.meta.url);

test("community page is routed and reachable from the navbar", async () => {
  assert.equal(existsSync(communityPageUrl), true);

  const appLayout = await readFile(
    new URL("../src/app/AppLayout.tsx", import.meta.url),
    "utf8"
  );
  const navbar = await readFile(
    new URL("../src/components/Navbar.tsx", import.meta.url),
    "utf8"
  );

  assert.match(appLayout, /import CommunityPage from "@\/pages\/CommunityPage"/);
  assert.match(appLayout, /pathname === "\/community"/);
  assert.match(appLayout, /<CommunityPage \/>/);
  assert.match(navbar, /name: "公开动态",\s*href: "\/community"/);
});

test("community page presents public dynamics as the primary surface", async () => {
  const page = await readFile(communityPageUrl, "utf8");

  for (const fragment of [
    "fetchPublicPostCursorList",
    "fetchFollowingPostCursorList",
    "fetchFollowingMediaCursorList",
    "fetchForumBoardList",
    "fetchForumPostCursorList",
    "createForumPost",
    "PostCard",
    "DiscoverPictureCard",
    "公开动态",
    "关注动态",
    "关注作品",
    "论坛",
    "发布讨论",
  ]) {
    assert.match(page, new RegExp(fragment));
  }

  assert.match(page, /isAuthenticated/);
  assert.match(page, /请先登录/);
  assert.match(page, /查看当前公开权限的动态/);
  assert.doesNotMatch(page, /公开动态与论坛/);
  assert.doesNotMatch(page, /动态广场/);
});
