import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("frontend exposes follow API contracts and maps profile counts", async () => {
  const [types, api, profile] = await Promise.all([
    source("../src/lib/types.ts"),
    source("../src/lib/api.ts"),
    source("../src/lib/account-profile.ts"),
  ]);

  for (const fragment of [
    "followerCount: number",
    "followingCount: number",
    "isFollowing: boolean",
    "export interface FollowTargetRequest",
    "export interface FollowStatusResponse",
  ]) {
    assert.match(types, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(api, /export async function followUser/);
  assert.match(api, /"\/api\/follow\/create"/);
  assert.match(api, /export async function unfollowUser/);
  assert.match(api, /"\/api\/follow\/cancel"/);
  assert.match(api, /export async function fetchFollowStatus/);
  assert.match(api, /"\/api\/follow\/status"/);
  assert.match(profile, /followers:\s*detail\.followerCount\s*\?\?\s*0/);
  assert.match(profile, /following:\s*detail\.followingCount\s*\?\?\s*0/);
  assert.match(profile, /isFollowing:\s*detail\.isFollowing\s*\?\?\s*false/);
});

test("profile page and discover dialog wire follow UI to real APIs", async () => {
  const [accountPage, discoverPage, photographerInfo] = await Promise.all([
    source("../src/pages/AccountDetailPage.tsx"),
    source("../src/pages/DiscoverPage.tsx"),
    source("../src/components/photo/PhotographerInfo.tsx"),
  ]);

  assert.match(accountPage, /followUser/);
  assert.match(accountPage, /unfollowUser/);
  assert.match(accountPage, /profile\.isFollowing\s*\?\s*"已关注"\s*:\s*"关注"/);
  assert.match(accountPage, /Check/);
  assert.match(accountPage, /profile\.isFollowing && !followPending[\s\S]*<Check/);
  assert.match(accountPage, /label:\s*"粉丝",\s*value:\s*profile\.followers/);
  assert.match(accountPage, /label:\s*"关注",\s*value:\s*profile\.following/);

  assert.match(discoverPage, /fetchFollowStatus/);
  assert.match(discoverPage, /followUser/);
  assert.match(discoverPage, /unfollowUser/);
  assert.doesNotMatch(discoverPage, /关注功能即将上线/);
  assert.match(discoverPage, /isFollowing=\{activeOwnerFollowState\?\.isFollowing \?\? false\}/);

  assert.match(photographerInfo, /Check/);
  assert.match(photographerInfo, /isFollowing && !followPending[\s\S]*<Check/);
});
