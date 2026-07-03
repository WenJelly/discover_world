import type { AuthUser, DetailUserResponse, LoginResponse } from "./types";

export function toAuthUser(resp: LoginResponse | DetailUserResponse): AuthUser {
  const email = resp.email || resp.userEmail || "";
  const username = resp.username || resp.userName || email;
  const nickname = resp.nickname || username;
  const avatarUrl = resp.avatarUrl || resp.userAvatar || "";
  const bio = resp.bio || resp.userProfile || "";
  const role = resp.role || resp.userRole || "user";
  const createdAt = resp.createdAt || resp.createTime || "";
  const updatedAt = resp.updatedAt || resp.updateTime || "";

  return {
    id: resp.id,
    username,
    email,
    phone: resp.phone || "",
    nickname,
    avatarUrl,
    bio,
    status: resp.status || "active",
    role,
    createdAt,
    updatedAt,
    userEmail: email,
    userName: nickname,
    userAvatar: avatarUrl,
    userProfile: bio,
    userRole: role,
    createTime: createdAt,
    updateTime: updatedAt,
  };
}

export function mergeAccountDetailIntoAuthUser(
  current: AuthUser,
  detail: DetailUserResponse
): AuthUser {
  return {
    ...current,
    ...toAuthUser(detail),
  };
}
