# Community Backend Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first backend community layer: public post feed, forum board/discussion metadata, forum post creation/listing, and basic moderation actions.

**Architecture:** Reuse existing `post`, `asset_link`, `comment_record`, `reaction`, `favorite`, and `entity_stat` behavior for dynamic content. Add focused forum metadata models instead of duplicating post content, and keep moderation/reporting as separate records so public feed, forum, and personal profile posts share one post lifecycle.

**Tech Stack:** Go, go-zero REST, go-zero sqlx, MySQL, existing auth/response helpers, source-level contract tests, focused Go unit tests.

---

### Task 1: Public Post Feed Contract

**Files:**
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Modify: `internal/handler/routes.go`
- Create: `internal/handler/post/getpublicpostcursorlisthandler.go`
- Create: `internal/logic/post/getpublicpostcursorlistlogic.go`
- Modify: `model/postmodel.go`
- Test: `internal/logic/post/public_feed_contract_test.go`
- Test: `model/post_public_feed_test.go`

- [ ] Add failing contract tests for `/api/post/public/list/cursor`, `PublicPostListRequest`, `PublicPostCursorPageResponse`, and public route registration without JWT.
- [ ] Add failing model tests for SQL fragments: active/public/non-deleted posts, active author account, `latest`, `hot`, and `rising` ordering hooks.
- [ ] Implement post model public-feed query methods and cursor helpers.
- [ ] Implement logic that builds existing `ProfilePostResponse` items with author summaries and viewer state when a JWT viewer is available later; first version is public/no-viewer.
- [ ] Run `go test ./internal/logic/post ./model ./internal/handler -run 'PublicPost|PostPublic' -count=1`.

### Task 2: Forum Metadata Models

**Files:**
- Create: `model/forumboardmodel.go`
- Create: `model/postdiscussionmodel.go`
- Test: `model/forum_model_contract_test.go`
- Modify: `internal/svc/servicecontext.go`

- [ ] Add failing model contract tests for `ForumBoardModel`, `PostDiscussionModel`, and service-context registration.
- [ ] Implement `ForumBoard` rows with `id`, `slug`, `name`, `description`, `status`, `sort_order`, timestamps, and soft delete.
- [ ] Implement `PostDiscussion` rows with `post_id`, `board_id`, `title`, `is_locked`, `is_board_pinned`, `board_pinned_at`, `last_activity_at`, and status.
- [ ] Add models to `ServiceContext` and transaction session wiring.
- [ ] Run `go test ./model ./internal/svc -run 'Forum|PostDiscussion' -count=1`.

### Task 3: Forum Public and Auth APIs

**Files:**
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Create: `internal/handler/forum/*.go`
- Create: `internal/logic/forum/*.go`
- Modify: `internal/handler/routes.go`
- Test: `internal/logic/forum/forum_contract_test.go`
- Test: `internal/handler/forum_route_contract_test.go`

- [ ] Add failing route/type tests for `/api/forum/board/list`, `/api/forum/post/list/cursor`, and authenticated `/api/forum/post/create`.
- [ ] Implement board list and forum post list using `forum_board`, `post_discussion`, `post`, and existing post response assembly.
- [ ] Implement forum post create by inserting `post`, `post_discussion`, `asset_link`, and `entity_stat` in one transaction.
- [ ] Reject create requests for missing board, inactive board, empty title, locked target, and invalid image ownership.
- [ ] Run `go test ./internal/logic/forum ./internal/handler -run Forum -count=1`.

### Task 4: Moderation Records and Admin Actions

**Files:**
- Create: `model/moderationreportmodel.go`
- Create: `internal/handler/moderation/*.go`
- Create: `internal/logic/moderation/*.go`
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Modify: `internal/handler/routes.go`
- Test: `internal/logic/moderation/moderation_contract_test.go`
- Test: `model/moderation_report_model_test.go`

- [ ] Add failing tests for report creation, admin hide/restore/lock/unlock/pin/unpin route contracts, and role-gated admin routes.
- [ ] Implement user report creation for `post` and `comment_record`.
- [ ] Implement admin hide/restore for posts and comments.
- [ ] Implement admin lock/unlock and board-pin/unpin for forum discussions.
- [ ] Run `go test ./internal/logic/moderation ./model -run Moderation -count=1`.

### Task 5: Hourly Stats for Post Ranking

**Files:**
- Modify: `internal/logic/post/getpostdetaillogic.go`
- Modify: `internal/logic/post/togglepostreactionlogic.go`
- Modify: `internal/logic/post/togglepostfavoritelogic.go`
- Modify: `internal/logic/post/createpostcommentlogic.go`
- Test: `internal/logic/post/post_hourly_stats_contract_test.go`

- [ ] Add failing source-level tests proving post view/reaction/favorite/comment actions update both `entity_stat` and `entity_stat_hourly`.
- [ ] Update post detail, reaction, favorite, and comment logic to write hourly counters in the same transaction where possible.
- [ ] Run `go test ./internal/logic/post -run 'Hourly|Toggle|Comment|Detail' -count=1`.

### Task 6: Schema Docs and Verification

**Files:**
- Modify: `docs/数据库信息.md`
- Modify: `docs/后端功能与逻辑说明.md`

- [ ] Document `forum_board`, `post_discussion`, and `moderation_report`.
- [ ] Document public feed, forum, and moderation API behavior.
- [ ] Run `go test ./model ./internal/logic/post ./internal/logic/forum ./internal/logic/moderation ./internal/handler -count=1`.
- [ ] Run `go test ./...`.
- [ ] Run `go build ./...`.
