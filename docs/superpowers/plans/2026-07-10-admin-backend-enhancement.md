# Admin Backend Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build backend-only admin enhancements for moderation queues, operation management, lightweight capabilities, and audit logging.

**Architecture:** Keep Discover World as a go-zero REST monolith. Add focused admin support models and helper logic, then wire existing admin, media, moderation, and operation endpoints into shared capability checks and append-only audit logs.

**Tech Stack:** Go, go-zero REST, MySQL via sqlx, existing hand-written models, source-contract tests, `go test`.

---

## File Structure

- Create `model/adminoperationlogmodel.go`: append-only audit log model with insert, list, detail, and count helpers.
- Create `model/adminrolepolicymodel.go`: role capability lookup model with `admin` superuser fallback handled in logic.
- Modify `model/moderationreportmodel.go`: add query and resolve methods plus handler fields.
- Modify `model/commentrecordmodel.go`: add admin status update helpers.
- Modify `model/postmodel.go` and `model/postdiscussionmodel.go`: keep existing status helpers, use them from audited admin logic.
- Modify `model/tagmodel.go` and `model/taggingmodel.go`: add admin tag list/update and merge support.
- Modify `model/sitestatsmodel.go`: add admin dashboard aggregate query helpers only if a separate admin query is clearer than embedding SQL in logic.
- Create `internal/logic/adminsupport/common.go`: admin capability, pagination, reason validation, JSON snapshot, audit log write helpers.
- Modify `internal/svc/servicecontext.go`: register new models.
- Modify `internal/types/types.go` and `api/discover_world.api`: add admin request/response contracts.
- Create or modify handlers under `internal/handler/admin`, `internal/handler/moderation`, and routes in `internal/handler/routes.go`.
- Modify existing admin/media/moderation logic so every backend write operation checks capability and records audit.
- Update `sql/create/*.sql`, `sql/database.md`, `docs/数据库信息.md`, and `docs/后端功能与逻辑说明.md`.

## Task 1: Schema And Model Contracts

**Files:**
- Create: `model/adminoperationlogmodel.go`
- Create: `model/adminrolepolicymodel.go`
- Modify: `model/moderationreportmodel.go`
- Modify: `model/commentrecordmodel.go`
- Modify: `model/tagmodel.go`
- Modify: `model/taggingmodel.go`
- Modify: `internal/svc/servicecontext.go`
- Test: `model/admin_backend_models_contract_test.go`

- [ ] **Step 1: Write failing model contract tests**

Create `model/admin_backend_models_contract_test.go` with source checks for these signatures:

```go
func TestAdminBackendModelContracts(t *testing.T) {
    assertFileContains(t, "adminoperationlogmodel.go",
        "type AdminOperationLogModel interface",
        "Insert(ctx context.Context, data *AdminOperationLog) (sql.Result, error)",
        "FindByID(ctx context.Context, id uint64) (*AdminOperationLog, error)",
        "FindByFilter(ctx context.Context, filter AdminOperationLogFilter, pageNum int64, pageSize int64) ([]*AdminOperationLog, error)",
        "CountByFilter(ctx context.Context, filter AdminOperationLogFilter) (int64, error)")
    assertFileContains(t, "adminrolepolicymodel.go",
        "type AdminRolePolicyModel interface",
        "HasCapability(ctx context.Context, role string, capability string) (bool, error)")
    assertFileContains(t, "moderationreportmodel.go",
        "FindByFilter(ctx context.Context, filter ModerationReportFilter, pageNum int64, pageSize int64) ([]*ModerationReport, error)",
        "CountByFilter(ctx context.Context, filter ModerationReportFilter) (int64, error)",
        "Resolve(ctx context.Context, req ResolveModerationReportRequest) error")
    assertFileContains(t, "commentrecordmodel.go",
        "SetStatus(ctx context.Context, id uint64, status string) error")
    assertFileContains(t, "tagmodel.go",
        "FindByFilter(ctx context.Context, filter TagFilter, pageNum int64, pageSize int64) ([]*Tag, error)",
        "CountByFilter(ctx context.Context, filter TagFilter) (int64, error)")
    assertFileContains(t, "taggingmodel.go",
        "MoveTaggings(ctx context.Context, sourceTagID uint64, targetTagID uint64) error")
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./model -run TestAdminBackendModelContracts -count=1`

Expected: fail because `adminoperationlogmodel.go` and `adminrolepolicymodel.go` do not exist and existing interfaces lack admin methods.

- [ ] **Step 3: Implement models**

Add hand-written SQL models matching existing style. Use structured filters instead of raw SQL strings for admin-only tables. Keep page sizes capped at 100 in logic, not model.

- [ ] **Step 4: Register models in service context**

Add `AdminOperationLogModel` and `AdminRolePolicyModel` to `ServiceContext`, `NewServiceContext`, and `withSession`.

- [ ] **Step 5: Run model tests**

Run: `go test ./model -count=1`

Expected: pass.

## Task 2: Schema Documentation

**Files:**
- Create or modify: `sql/create/admin_operation_log.sql`
- Create or modify: `sql/create/admin_role_policy.sql`
- Modify: `sql/create/moderation_report.sql`
- Modify: `sql/database.md`
- Modify: `docs/数据库信息.md`

- [ ] **Step 1: Write schema docs**

Add `admin_operation_log` and `admin_role_policy` DDL. Extend `moderation_report` with:

```sql
`handler_user_id` BIGINT UNSIGNED DEFAULT NULL,
`resolution` VARCHAR(30) DEFAULT NULL,
`resolution_note` TEXT DEFAULT NULL,
`resolved_at` DATETIME DEFAULT NULL
```

- [ ] **Step 2: Add migration notes**

Document `ALTER TABLE moderation_report ...` and `CREATE TABLE IF NOT EXISTS ...` statements in `docs/数据库信息.md`.

- [ ] **Step 3: Verify docs reference the same table names**

Run: `rg -n "admin_operation_log|admin_role_policy|handler_user_id|resolution_note" sql docs`

Expected: all schema names appear in both SQL and docs.

## Task 3: Admin Support Helpers

**Files:**
- Create: `internal/logic/adminsupport/common.go`
- Test: `internal/logic/adminsupport/common_test.go`

- [ ] **Step 1: Write failing helper tests**

Test `NormalizePage`, `NormalizeReason`, `HasAdminCapability`, and `BuildAuditSnapshot`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logic/adminsupport -count=1`

Expected: fail because package does not exist.

- [ ] **Step 3: Implement helpers**

Implement:

```go
const (
    CapabilityAccountManage   = "admin.account.manage"
    CapabilityMediaReview     = "admin.media.review"
    CapabilityContentModerate = "admin.content.moderate"
    CapabilityOperationManage = "admin.operation.manage"
    CapabilityAuditRead       = "admin.audit.read"
)
```

`RequireAdminCapability` should load the admin from context, allow role `admin`, otherwise call `AdminRolePolicyModel.HasCapability`.

- [ ] **Step 4: Run helper tests**

Run: `go test ./internal/logic/adminsupport -count=1`

Expected: pass.

## Task 4: API Types And Route Contracts

**Files:**
- Modify: `api/discover_world.api`
- Modify: `internal/types/types.go`
- Modify: `internal/handler/routes.go`
- Test: `internal/handler/admin_backend_route_contract_test.go`

- [ ] **Step 1: Write failing route contract test**

Check these routes exist and are inside `serverCtx.AdminCheck` groups:

```text
/api/admin/moderation/report/list
/api/admin/moderation/report/detail
/api/admin/moderation/report/resolve
/api/admin/moderation/content/list
/api/admin/moderation/comment/hide
/api/admin/moderation/comment/restore
/api/admin/operation/dashboard
/api/admin/operation/tag/list
/api/admin/operation/tag/update
/api/admin/operation/tag/merge
/api/admin/operation/content/feature
/api/admin/operation/content/unfeature
/api/admin/audit/operation/list
/api/admin/audit/operation/detail
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/handler -run TestAdminBackendEnhancementRoutes -count=1`

Expected: fail because routes are missing.

- [ ] **Step 3: Add request and response types**

Add concrete types for report pages, content query pages, dashboard response, tag pages, audit log pages, and extended admin moderation requests.

- [ ] **Step 4: Add handlers and routes**

Follow existing handler pattern: decode JSON with `httpx.Parse`, call logic constructor, respond with `commonresponse.Response`.

- [ ] **Step 5: Run route tests**

Run: `go test ./internal/handler -run TestAdminBackendEnhancementRoutes -count=1`

Expected: pass.

## Task 5: Moderation Reports And Content Governance

**Files:**
- Create: `internal/logic/moderation/getadminmoderationreportlistlogic.go`
- Create: `internal/logic/moderation/getadminmoderationreportdetaillogic.go`
- Create: `internal/logic/moderation/resolveadminmoderationreportlogic.go`
- Create: `internal/logic/moderation/getadmincontentlistlogic.go`
- Create: `internal/logic/moderation/adminhidecommentlogic.go`
- Create: `internal/logic/moderation/adminrestorecommentlogic.go`
- Modify: existing admin post/forum moderation logic files
- Test: `internal/logic/moderation/admin_backend_moderation_contract_test.go`

- [ ] **Step 1: Write failing moderation logic tests**

Use source contract tests to verify every admin moderation logic calls `adminsupport.RequireAdminCapability`, writes `AdminOperationLogModel.Insert`, and uses `reportId` metadata when present.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logic/moderation -run TestAdminBackendModerationContracts -count=1`

Expected: fail because new logic files and audit calls are missing.

- [ ] **Step 3: Implement report list/detail/resolve**

Report resolve should be transactional when it changes both target content and `moderation_report`.

- [ ] **Step 4: Implement comment hide/restore**

Map hide to `comment_record.status='hidden'` and restore to `status='active'`.

- [ ] **Step 5: Update existing post/forum governance**

Extend request handling to accept `reason` and `reportId`, then write audit logs for hide/restore/lock/unlock/pin/unpin.

- [ ] **Step 6: Run moderation tests**

Run: `go test ./internal/logic/moderation -count=1`

Expected: pass.

## Task 6: Media Review Audit

**Files:**
- Modify: `internal/logic/media/reviewmediaassetlogic.go`
- Test: `internal/logic/media/media_review_admin_audit_source_test.go`

- [ ] **Step 1: Write failing media review audit test**

Assert `ReviewMediaAssetLogic` requires `adminsupport.CapabilityMediaReview` and writes `AdminOperationLogModel.Insert`.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logic/media -run TestReviewMediaAssetWritesAdminAudit -count=1`

Expected: fail because audit is not wired.

- [ ] **Step 3: Implement media review audit**

Capture before/after snapshots of `media_asset.audit_status` and `metadata_json`. Keep existing `notification(event_type='media_review')` behavior.

- [ ] **Step 4: Run media tests**

Run: `go test ./internal/logic/media -count=1`

Expected: pass.

## Task 7: Operation Dashboard, Tags, And Featured Content

**Files:**
- Create: `internal/logic/admin/getadminoperationdashboardlogic.go`
- Create: `internal/logic/admin/getadmintaglistlogic.go`
- Create: `internal/logic/admin/updateadmintaglogic.go`
- Create: `internal/logic/admin/mergeadmintaglogic.go`
- Create: `internal/logic/admin/featureadmincontentlogic.go`
- Create: `internal/logic/admin/unfeatureadmincontentlogic.go`
- Test: `internal/logic/admin/admin_operation_contract_test.go`

- [ ] **Step 1: Write failing operation tests**

Verify dashboard, tag updates, tag merges, feature, and unfeature logic require `admin.operation.manage` and write audit logs for writes.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logic/admin -run TestAdminOperationContracts -count=1`

Expected: fail because operation logic is missing.

- [ ] **Step 3: Implement dashboard**

Return counts for pending media, open reports, active users, public works, public posts, last 24h media/posts/reports, and top media/posts from `entity_stat`.

- [ ] **Step 4: Implement tag list/update/merge**

Update tags through `TagModel`; merge by moving taggings then disabling the source tag.

- [ ] **Step 5: Implement content feature/unfeature**

Only allow `targetType=media_asset`, active approved work assets. Reuse `asset_link` with site owner and configured link role.

- [ ] **Step 6: Run admin operation tests**

Run: `go test ./internal/logic/admin -count=1`

Expected: pass.

## Task 8: Audit Query APIs

**Files:**
- Create: `internal/logic/admin/getadminoperationloglistlogic.go`
- Create: `internal/logic/admin/getadminoperationlogdetaillogic.go`
- Test: `internal/logic/admin/admin_audit_contract_test.go`

- [ ] **Step 1: Write failing audit tests**

Verify audit list/detail require `admin.audit.read`, query `AdminOperationLogModel`, and return sanitized operator summaries.

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/logic/admin -run TestAdminAuditContracts -count=1`

Expected: fail because audit logic is missing.

- [ ] **Step 3: Implement audit list/detail**

Use filters from request, normalize page, and build operator summaries from `UserAccountModel` and `UserProfileModel`.

- [ ] **Step 4: Run audit tests**

Run: `go test ./internal/logic/admin -count=1`

Expected: pass.

## Task 9: Documentation And Full Verification

**Files:**
- Modify: `docs/后端功能与逻辑说明.md`
- Modify: `docs/数据库信息.md`
- Modify: `api/discover_world.api`

- [ ] **Step 1: Update backend docs**

Document all admin routes, capability names, audit behavior, and moderation report workflow.

- [ ] **Step 2: Run focused tests**

Run:

```bash
go test ./model ./internal/logic/adminsupport ./internal/logic/moderation ./internal/logic/media ./internal/logic/admin ./internal/handler -count=1
```

Expected: pass.

- [ ] **Step 3: Run full backend tests**

Run:

```bash
go test ./...
```

Expected: pass, or report any unrelated pre-existing failures with exact package and error text.

- [ ] **Step 4: Review changed files**

Run:

```bash
git diff --stat
git diff -- api/discover_world.api internal/types/types.go internal/svc/servicecontext.go
```

Expected: backend-only code and docs changes; no frontend files.
