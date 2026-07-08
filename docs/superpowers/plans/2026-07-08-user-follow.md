# 用户关注功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现普通单向关注：关注/取关接口、个人主页关注计数与按钮、作品详情弹窗关注按钮接真实 API。

**Architecture:** 后端以 `user_follow` 作为唯一关系表，model 提供幂等关注/取关、计数和列表查询；API 新增 JWT follow 分组；账号详情聚合关注计数和当前 viewer 关系。前端通过 `api.ts` 封装关注接口，`AccountDetailPage` 和 `DiscoverPage` 使用同一套状态更新语义。

**Tech Stack:** Go + go-zero + sqlx + MySQL；React + TypeScript + Vite；测试包含 Go 单元测试与 `frontend/tests` 源码契约测试。

---

### Task 1: UserFollowModel 查询与幂等写入

**Files:**
- Modify: `model/userfollowmodel.go`
- Test: `model/userfollowmodel_test.go`

- [ ] **Step 1: Write failing tests**

新增测试验证接口存在且 SQL 语义正确：

```go
func TestUserFollowModelMethodsUseExpectedSQL(t *testing.T) {
    sqls := []string{
        "insert into %s (`follower_id`,`following_id`,`status`) values (?, ?, 1) on duplicate key update `status` = 1",
        "update %s set `status` = 0 where `follower_id` = ? and `following_id` = ?",
        "select count(1) from %s where `following_id` = ? and `status` = 1",
        "select count(1) from %s where `follower_id` = ? and `status` = 1",
    }
    for _, sql := range sqls {
        if !strings.Contains(userfollowmodelSource, sql) {
            t.Fatalf("missing SQL fragment %q", sql)
        }
    }
}
```

- [ ] **Step 2: Run failing test**

Run: `go test ./model -run UserFollow -count=1`
Expected: FAIL because custom methods do not exist yet.

- [ ] **Step 3: Implement model methods**

Add methods to `UserFollowModel`: `Follow`, `Unfollow`, `IsFollowing`, `CountFollowers`, `CountFollowing`, `ListFollowerIDs`, `ListFollowingIDs`.

- [ ] **Step 4: Run model tests**

Run: `go test ./model -run UserFollow -count=1`
Expected: PASS.

### Task 2: Follow API and business logic

**Files:**
- Modify: `api/discover_world.api`
- Modify generated files via goctl or manual equivalent: `internal/types/types.go`, `internal/handler/routes.go`
- Create: `internal/handler/follow/*.go`
- Create: `internal/logic/follow/*.go`
- Modify: `internal/svc/servicecontext.go`
- Test: `internal/logic/follow/follow_common_test.go`

- [ ] **Step 1: Write failing logic tests**

Cover: cannot follow self, inactive target rejected, repeat follow is idempotent, repeat unfollow is idempotent.

- [ ] **Step 2: Run failing tests**

Run: `go test ./internal/logic/follow -count=1`
Expected: FAIL because package/routes do not exist yet.

- [ ] **Step 3: Add API contract**

Add `FollowTargetRequest`, `FollowStatusResponse`, `FollowListRequest`, `FollowUserListResponse`, and JWT routes under `/api/follow/*`.

- [ ] **Step 4: Implement logic**

Use login user from context, validate target account with `FindOneActive`, reject self-follow, call `UserFollowModel`, and build status/list responses from public account summaries.

- [ ] **Step 5: Run follow tests**

Run: `go test ./internal/logic/follow -count=1`
Expected: PASS.

### Task 3: Account detail follow counts and state

**Files:**
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Modify: `internal/logic/account/account_common.go`
- Modify: `internal/logic/account/detailaccountlogic.go`
- Test: `internal/logic/account/account_common_test.go`

- [ ] **Step 1: Write failing tests**

Extend account tests so detail response includes `FollowerCount`, `FollowingCount`, and `IsFollowing`; non-owner public masking keeps email/phone hidden.

- [ ] **Step 2: Run failing tests**

Run: `go test ./internal/logic/account -count=1`
Expected: FAIL because fields are missing/zero.

- [ ] **Step 3: Implement aggregation**

`loadDetailAccountResponse` counts followers/following; `DetailAccountLogic` sets `IsFollowing` for viewer -> target after target is known.

- [ ] **Step 4: Run account tests**

Run: `go test ./internal/logic/account -count=1`
Expected: PASS.

### Task 4: Frontend API and profile mapping

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/account-profile.ts`
- Test: `frontend/tests/account-follow-contract.test.mjs`

- [ ] **Step 1: Write failing frontend contract tests**

Assert types and source contain `followerCount`, `followingCount`, `isFollowing`, `followUser`, `unfollowUser`, and `fetchFollowStatus`.

- [ ] **Step 2: Run failing tests**

Run: `npm test`
Expected: FAIL because follow API helpers and mappings do not exist.

- [ ] **Step 3: Implement frontend API helpers**

Add follow request/response types and exported helpers for create/cancel/status.

- [ ] **Step 4: Map profile counts**

`toAccountProfile` maps backend counts into `followers` and `following`.

- [ ] **Step 5: Run frontend tests**

Run: `npm test`
Expected: PASS.

### Task 5: Frontend UI wiring

**Files:**
- Modify: `frontend/src/pages/AccountDetailPage.tsx`
- Modify: `frontend/src/pages/DiscoverPage.tsx`
- Optional modify: `frontend/src/components/photo/PhotoDetailDialog.tsx`
- Test: `frontend/tests/account-follow-contract.test.mjs`

- [ ] **Step 1: Extend failing contract tests**

Assert AccountDetailPage renders follow button for non-own profile, stats include 粉丝/关注, and DiscoverPage no longer contains “关注功能即将上线”.

- [ ] **Step 2: Run failing tests**

Run: `npm test`
Expected: FAIL before UI is wired.

- [ ] **Step 3: Implement AccountDetailPage UI**

Add follow button with pending state and optimistic follower count updates. Hide button on own profile.

- [ ] **Step 4: Implement DiscoverPage follow handler**

Use active media owner id and real follow/unfollow API. Hide follow for own media.

- [ ] **Step 5: Run frontend tests**

Run: `npm test`
Expected: PASS.

### Task 6: Database docs and full verification

**Files:**
- Modify: `docs/数据库信息.md`

- [ ] **Step 1: Update docs**

Add composite indexes and existing-DB upgrade SQL for `user_follow`; document that `followers` visibility remains second phase.

- [ ] **Step 2: Backend verification**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 3: Frontend verification**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Build verification**

Run: `npm run build`
Expected: PASS, except existing Vite chunk-size warning if present.
