import assert from "node:assert/strict";
import test from "node:test";

import { mergeAccountDetailIntoAuthUser } from "../src/lib/auth-user.ts";
import type { AuthUser, DetailUserResponse } from "../src/lib/types.ts";

test("mergeAccountDetailIntoAuthUser updates avatar fields from account detail", () => {
  const current = {
    id: "7",
    username: "alice",
    email: "alice@example.com",
    nickname: "Alice",
    avatarUrl: "https://cdn.example.com/old.jpg",
    bio: "old bio",
    status: "active",
    role: "user",
    createdAt: "2026-07-01 10:00:00",
    updatedAt: "2026-07-01 10:00:00",
    userEmail: "alice@example.com",
    userName: "Alice",
    userAvatar: "https://cdn.example.com/old.jpg",
    userProfile: "old bio",
    userRole: "user",
    createTime: "2026-07-01 10:00:00",
    updateTime: "2026-07-01 10:00:00",
  } as AuthUser;
  const detail = {
    id: "7",
    username: "alice",
    email: "alice@example.com",
    nickname: "Alice",
    avatarUrl: "https://cdn.example.com/new.jpg",
    bio: "new bio",
    status: "active",
    role: "user",
    createdAt: "2026-07-01 10:00:00",
    updatedAt: "2026-07-03 09:00:00",
  } as DetailUserResponse;

  const next = mergeAccountDetailIntoAuthUser(current, detail);

  assert.equal(next.avatarUrl, "https://cdn.example.com/new.jpg");
  assert.equal(next.userAvatar, "https://cdn.example.com/new.jpg");
  assert.equal(next.bio, "new bio");
  assert.equal(next.userProfile, "new bio");
  assert.equal(next.updatedAt, "2026-07-03 09:00:00");
});
