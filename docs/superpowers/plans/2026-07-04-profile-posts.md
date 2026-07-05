# Profile Posts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend MVP support for personal-profile image/text posts.

**Architecture:** Reuse the existing generic data model: `post` for the dynamic item, `asset_link` for images, and `reaction` / `favorite` / `comment_record` / `entity_stat` for interactions and counts. Add a focused `internal/logic/post` package and hand-wire go-zero handlers/routes to avoid overwriting existing scaffold edits.

**Tech Stack:** Go, go-zero REST, go-zero sqlx, MySQL models, existing response/auth helpers.

---

### Task 1: Rule Tests

**Files:**
- Create: `internal/logic/post/common_test.go`
- Create: `internal/logic/post/common.go`

- [ ] Write failing tests for content trimming, visibility normalization, image ID parsing, and attachment count limits.
- [ ] Run `go test ./internal/logic/post` and confirm the package fails before implementation.
- [ ] Implement minimal helpers in `internal/logic/post/common.go`.
- [ ] Run `go test ./internal/logic/post` and confirm the tests pass.

### Task 2: Model Helpers

**Files:**
- Modify: `model/postmodel.go`
- Modify: `model/assetlinkmodel.go`
- Modify: `model/entitystatmodel.go`
- Modify: `model/reactionmodel.go`
- Modify: `model/favoritemodel.go`
- Modify: `model/commentrecordmodel.go`
- Create: `model/postmodel_test.go`

- [ ] Write failing tests for model-only helper behavior that does not require a live database.
- [ ] Add post insert/find/update/soft-delete query methods.
- [ ] Add attachment replacement helpers.
- [ ] Add stat ensure/increment helpers with whitelisted counters.
- [ ] Add reaction/favorite toggle helpers.
- [ ] Add comment cursor-list helpers.
- [ ] Run `go test ./model`.

### Task 3: Service Transaction Boundary

**Files:**
- Modify: `internal/svc/servicecontext.go`
- Modify: `internal/svc/servicecontext_test.go`

- [ ] Add a stored `sqlx.SqlConn` to `ServiceContext`.
- [ ] Add `Transact(ctx, fn)` that delegates to `SqlConn.TransactCtx`.
- [ ] Run `go test ./internal/svc`.

### Task 4: Post Logic

**Files:**
- Create: `internal/logic/post/createpostlogic.go`
- Create: `internal/logic/post/updatepostlogic.go`
- Create: `internal/logic/post/deletepostlogic.go`
- Create: `internal/logic/post/getpostdetaillogic.go`
- Create: `internal/logic/post/togglepostreactionlogic.go`
- Create: `internal/logic/post/togglepostfavoritelogic.go`
- Create: `internal/logic/post/createpostcommentlogic.go`
- Create: `internal/logic/post/getpostcommentcursorlistlogic.go`

- [ ] Implement create/update/delete/detail using existing auth and response helpers.
- [ ] Implement reaction/favorite toggles with stat deltas.
- [ ] Implement one-level comment create/list with comment count updates.
- [ ] Reuse media response assembly for post attachments.

### Task 5: API Wiring

**Files:**
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Create: `internal/handler/post/*.go`
- Modify: `internal/handler/routes.go`
- Modify: `internal/svc/servicecontext.go`

- [ ] Add request/response types for post and comment endpoints.
- [ ] Add handlers that parse requests and call post logic.
- [ ] Add authenticated `/api/post/*` routes.
- [ ] Register new models in `ServiceContext`.

### Task 6: Verification

**Files:**
- All changed Go files.

- [ ] Run `go test ./internal/logic/post ./model ./internal/svc`.
- [ ] Run `go test ./...`.
- [ ] Fix any failures with focused tests first.
