# Discover World Go Backend Modularization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the complete Discover World Go backend by go-zero API groups and model ownership, remove the current model import cycle, and make API regeneration reproducible without changing API, database, or business behavior.

**Architecture:** Keep go-zero's generated `internal/handler/<group>`, `internal/logic/<group>`, `internal/types`, and central `internal/svc` layout. Move every database/query model into `model/<module>`, keep generated and customized model code in the same package, group model dependencies under `svc.ModelSet`, and move non-route support logic into `internal/common`.

**Tech Stack:** Go 1.26, go-zero/goctl 1.10.1, MySQL/sqlx, Redis, Go standard library AST/parser tests.

---

## Working Tree Safety

The repository already contains unrelated staged and unstaged changes. Every implementation task must:

- inspect `git status --short` before editing;
- preserve existing frontend and unrelated user changes;
- use `apply_patch` for source edits and moves;
- format only the Go files touched by the task;
- stage and commit only the explicit paths listed by that task with `git commit --only`;
- never use `git reset`, `git checkout --`, or broad cleanup commands.

## Target File Structure

```text
discoverworld.go
etc/discoverworld.yaml
api/discover_world.api
api/modules/*.api
architecture/backend_structure_test.go
internal/common/{access,adminsupport,auth,clientip,ipgeo,request,response}
internal/handler/<api-group>
internal/logic/<api-group>
internal/svc/{servicecontext,models,models_<module>,transaction}.go
internal/types/types.go
model/internal/modelutil/query.go
model/{account,admin,follow,forum,homepage,interaction,media,moderation,
       notification,post,profile,search,statistics,taxonomy}/*.go
```

## Model Ownership and ServiceContext Mapping

| Model package | Files/types | `ModelSet` field |
| --- | --- | --- |
| `model/account` | `UserAccount` | `Models.Account.UserAccount` |
| `model/profile` | `UserProfile`, `Album` | `Models.Profile.UserProfile`, `Models.Profile.Album` |
| `model/follow` | `UserFollow` | `Models.Follow.UserFollow` |
| `model/media` | `StorageProvider`, `StorageBucket`, `MediaAsset`, `MediaObject`, `MediaUploadSession`, `MediaVariantRule`, `AssetLink`, `ShareLink` | `Models.Media.<type>` |
| `model/post` | `Post`, `PostDiscussion`, `CommentRecord` | `Models.Post.<type>` |
| `model/forum` | `ForumBoard` | `Models.Forum.ForumBoard` |
| `model/interaction` | `Reaction`, `Favorite` | `Models.Interaction.<type>` |
| `model/taxonomy` | `Tag`, `Tagging` | `Models.Taxonomy.<type>` |
| `model/statistics` | `EntityStat`, `EntityStatHourly`, `EntityRanking`, `SiteStats` | `Models.Statistics.<type>` |
| `model/moderation` | `ModerationReport`, `ContentIpAttribution` | `Models.Moderation.<type>` |
| `model/notification` | `Notification` | `Models.Notification.Notification` |
| `model/homepage` | `SiteConfig` | `Models.Homepage.SiteConfig` |
| `model/admin` | `AdminOperationLog`, `AdminRolePolicy` | `Models.Admin.<type>` |
| `model/search` | `SearchModel` | `Models.Search.Search` |

### Task 1: Add the Import-Cycle Regression Test

**Files:**
- Create: `architecture/backend_structure_test.go`

- [ ] **Step 1: Write the failing structural test**

```go
package architecture_test

import (
	"os"
	"path/filepath"
	"testing"
)

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}
	return root
}

func TestGeneratedModelsAreNotInAChildPackage(t *testing.T) {
	path := filepath.Join(repositoryRoot(t), "model", "gen")
	_, err := os.Stat(path)
	if err == nil {
		t.Fatalf("generated model subpackage must not exist: %s", path)
	}
	if !os.IsNotExist(err) {
		t.Fatalf("inspect generated model subpackage: %v", err)
	}
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./architecture -run TestGeneratedModelsAreNotInAChildPackage -count=1`

Expected: FAIL with `generated model subpackage must not exist`.

- [ ] **Step 3: Commit only the regression test**

```bash
git add architecture/backend_structure_test.go
git commit --only architecture/backend_structure_test.go -m "test: guard generated model package boundary"
```

### Task 2: Restore a Compilable go-zero Model Baseline

**Files:**
- Move: `model/gen/*model_gen.go` -> `model/*model_gen.go`
- Modify: `model/{assetlink,commentrecord,entitystat,favorite,mediaasset,mediaobject,mediauploadsession,mediavariantrule,reaction,sharelink,storagebucket,storageprovider,tagging,tag,useraccount,userfollow,userprofile}model.go`
- Modify: all current Go files importing `discover_world/model/gen`

- [ ] **Step 1: Confirm the current failure**

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./...`

Expected: FAIL with `import cycle not allowed` and the `discover_world/model -> discover_world/model/gen -> discover_world/model` chain.

- [ ] **Step 2: Move all generated files back beside their custom files**

For each of the 17 generated files, use `apply_patch` to move it to `model/`, change `package gen` to `package model`, remove the `discover_world/model` import, and change `model.ErrNotFound` to `ErrNotFound`.

The exact files are:

```text
assetlinkmodel_gen.go
commentrecordmodel_gen.go
entitystatmodel_gen.go
favoritemodel_gen.go
mediaassetmodel_gen.go
mediaobjectmodel_gen.go
mediauploadsessionmodel_gen.go
mediavariantrulemodel_gen.go
reactionmodel_gen.go
sharelinkmodel_gen.go
storagebucketmodel_gen.go
storageprovidermodel_gen.go
taggingmodel_gen.go
tagmodel_gen.go
useraccountmodel_gen.go
userfollowmodel_gen.go
userprofilemodel_gen.go
```

- [ ] **Step 3: Restore same-package custom model references**

In the matching custom model files:

- remove `discover_world/model/gen` imports;
- change `gen.<generatedInterface>` and `gen.<defaultModel>` back to the unqualified same-package symbols;
- change `gen.<Type>` back to `<Type>`;
- change `gen.<rowsVariable>` and `gen.<constructor>` back to same-package symbols.

The constructor pattern must be:

```go
type customAssetLinkModel struct {
	*defaultAssetLinkModel
}

func NewAssetLinkModel(conn sqlx.SqlConn) AssetLinkModel {
	return &customAssetLinkModel{
		defaultAssetLinkModel: newAssetLinkModel(conn),
	}
}
```

- [ ] **Step 4: Restore callers to the root model package**

Remove every `discover_world/model/gen` import under `internal/` and replace `gen.UserAccount`, `gen.UserProfile`, `gen.MediaAsset`, `gen.EntityStat`, `gen.CommentRecord`, and the other generated types with their existing `model.<Type>` form.

Run: `rg -n '"discover_world/model/gen"|\bgen\.' --glob '*.go'`

Expected: no output.

- [ ] **Step 5: Format and verify GREEN**

Run:

```bash
gofmt -w model/*.go internal/common/**/*.go internal/logic/**/*.go internal/svc/*.go
GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./...
GOCACHE=/tmp/discover-world-go-cache go build ./...
```

Expected: the architecture test, all Go tests, and build pass.

- [ ] **Step 6: Commit only the baseline repair**

Before editing, record the exact files returned by:

```bash
rg -l '"discover_world/model/gen"|\bgen\.' model internal --glob '*.go'
```

Stage only those recorded files plus the 17 generated-file moves. Use `git commit --only <recorded paths> <generated paths> -m "fix: restore go-zero model package boundary"`. Do not commit every file under `internal/logic` or `model` as a directory-wide shortcut.

### Task 3: Make goctl Regeneration Reproducible

**Files:**
- Modify: `api/modules/account.api`
- Modify: `api/modules/search.api`
- Modify: `api/modular_structure_test.go`
- Move: `main.go` -> `discoverworld.go`
- Move: `etc/application.yaml` -> `etc/discoverworld.yaml`
- Modify: `internal/config/loader.go`
- Create: `internal/config/loader_test.go`
- Modify: `sql/database.md`
- Modify: `docs/superpowers/specs/2026-07-14-go-backend-modular-structure-design.md`
- Regenerate: `internal/handler/routes.go`
- Regenerate: `internal/types/types.go`

- [ ] **Step 1: Add failing API middleware assertions**

Add these required snippets to the API structure test:

```go
requiredSnippets := []string{
	"middleware: LoginRateLimit",
	"middleware: RegisterRateLimit",
	"middleware: SearchRateLimit",
}
```

Add a config-path test in `internal/config/loader_test.go`:

```go
package config

import "testing"

func TestDefaultConfigPathUsesGoctlServiceName(t *testing.T) {
	if DefaultConfigPath != "etc/discoverworld.yaml" {
		t.Fatalf("DefaultConfigPath = %q", DefaultConfigPath)
	}
}
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
GOCACHE=/tmp/discover-world-go-cache go test ./api -count=1
GOCACHE=/tmp/discover-world-go-cache go test ./internal/config -run TestDefaultConfigPathUsesGoctlServiceName -count=1
```

Expected: middleware snippets are missing and the config path is still `etc/application.yaml`.

- [ ] **Step 3: Declare endpoint middleware in API files**

Split the unauthenticated account routes into two server blocks:

```goctl
@server (
	prefix:     /api
	group:      account
	middleware: LoginRateLimit
)
service DiscoverWorld {
	@handler LoginAccount
	post /account/login (LoginRequest) returns (LoginResponse)
}

@server (
	prefix:     /api
	group:      account
	middleware: RegisterRateLimit
)
service DiscoverWorld {
	@handler RegisterAccount
	post /account/register (RegisterRequest) returns (RegisterResponse)
}
```

Add `middleware: SearchRateLimit` to the search server block.

- [ ] **Step 4: Align the editable entrypoint and config with goctl names**

Move `main.go` to `discoverworld.go`, move `etc/application.yaml` to `etc/discoverworld.yaml`, set:

```go
const DefaultConfigPath = "etc/discoverworld.yaml"
```

Update the configuration path in `sql/database.md`. Preserve the full contents of the entrypoint and YAML file.

Update the approved design document's active directory/config references from `main.go` and `etc/application.yaml` to `discoverworld.go` and `etc/discoverworld.yaml`; keep the historical import-cycle explanation unchanged.

- [ ] **Step 5: Regenerate and verify no manual route edits are needed**

Run:

```bash
goctl api validate --api api/discover_world.api
goctl api go --api api/discover_world.api --dir . --style gozero
```

Expected:

- no extra `main.go` or `etc/application.yaml` is created;
- `routes.go` wraps login, register, and search through the declared middlewares;
- existing handler/logic business files are preserved.

- [ ] **Step 6: Run focused verification**

Run:

```bash
GOCACHE=/tmp/discover-world-go-cache go test ./api ./internal/config ./internal/handler/...
GOCACHE=/tmp/discover-world-go-cache go build ./...
```

Expected: PASS.

- [ ] **Step 7: Commit only regeneration-safety changes**

```bash
git commit --only api discoverworld.go main.go etc/discoverworld.yaml etc/application.yaml internal/config/loader.go internal/config/loader_test.go internal/handler/routes.go internal/types/types.go sql/database.md docs/superpowers/specs/2026-07-14-go-backend-modular-structure-design.md -m "refactor: make goctl regeneration reproducible"
```

### Task 4: Add Shared Model Query Utilities and Move Account Models

**Files:**
- Create: `model/internal/modelutil/query.go`
- Create: `model/account/{useraccountmodel.go,useraccountmodel_gen.go,vars.go}`
- Delete: root copies of those account model files
- Modify: account model consumers in `internal/common`, `internal/logic`, and `internal/svc`
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add the failing account ownership assertion**

Add helpers and the account test:

```go
func assertFilesExist(t *testing.T, paths ...string) {
	t.Helper()
	for _, path := range paths {
		if _, err := os.Stat(filepath.Join(repositoryRoot(t), path)); err != nil {
			t.Fatalf("required file %s: %v", path, err)
		}
	}
}

func TestAccountModelsLiveInAccountModule(t *testing.T) {
	assertFilesExist(t,
		"model/account/useraccountmodel.go",
		"model/account/useraccountmodel_gen.go",
		"model/account/vars.go",
	)
}
```

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./architecture -run TestAccountModelsLiveInAccountModule -count=1`

Expected: FAIL because `model/account` does not exist.

- [ ] **Step 2: Create the shared model-only query helper**

```go
package modelutil

import "strings"

func UniquePositiveIDs(ids []uint64) []uint64 {
	if len(ids) == 0 {
		return nil
	}

	seen := make(map[uint64]struct{}, len(ids))
	result := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func InPlaceholders(count int) string {
	if count <= 0 {
		return ""
	}
	parts := make([]string, count)
	for index := range parts {
		parts[index] = "?"
	}
	return strings.Join(parts, ",")
}
```

- [ ] **Step 3: Move the account model into package `account`**

Move both files, change their package declaration to `package account`, add a local `vars.go` containing:

```go
package account

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var ErrNotFound = sqlx.ErrNotFound
```

Update query helpers to `modelutil.UniquePositiveIDs` and `modelutil.InPlaceholders`.

- [ ] **Step 4: Update all account type consumers**

Import `accountmodel "discover_world/model/account"`. Replace `model.UserAccount`, `model.UserAccountModel`, and `model.NewUserAccountModel` with `accountmodel.UserAccount`, `accountmodel.UserAccountModel`, and `accountmodel.NewUserAccountModel` respectively. Do not change unrelated `model.*` references in the same files.

- [ ] **Step 5: Verify and commit**

Run:

```bash
gofmt -w model/account/*.go model/internal/modelutil/*.go architecture/*.go internal/common/**/*.go internal/logic/**/*.go internal/svc/*.go
GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./...
GOCACHE=/tmp/discover-world-go-cache go build ./...
```

Expected: PASS.

Commit only account/modelutil and updated consumers with message `refactor: move account models into module`.

### Task 5: Move Profile and Follow Models

**Files:**
- Create: `model/profile/{userprofilemodel.go,userprofilemodel_gen.go,albummodel.go,vars.go}`
- Create: `model/follow/{userfollowmodel.go,userfollowmodel_gen.go,vars.go}`
- Delete: corresponding root model files
- Modify: consumers under `internal/logic` and `internal/svc`
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add failing structure tests**

Add tests asserting the exact files above exist under `model/profile` and `model/follow`, then run:

```bash
GOCACHE=/tmp/discover-world-go-cache go test ./architecture -run 'Test(Profile|Follow)ModelsLiveInModule' -count=1
```

Expected: FAIL before the move.

- [ ] **Step 2: Move files and update package names**

Use `package profile` and `package follow`. Add a `vars.go` in each directory using the same `sqlx.ErrNotFound` alias pattern. Update `userprofilemodel.go` to use `modelutil.UniquePositiveIDs` and `modelutil.InPlaceholders`.

- [ ] **Step 3: Update consumers**

Use these aliases:

```go
profilemodel "discover_world/model/profile"
followmodel "discover_world/model/follow"
```

Replace only the owned model types and constructors.

- [ ] **Step 4: Verify and commit**

Run `gofmt`, `GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./...`, and `GOCACHE=/tmp/discover-world-go-cache go build ./...`.

Expected: PASS. Commit with `refactor: move profile and follow models into modules` using explicit paths.

### Task 6: Move Media Models

**Files:**
- Create: `model/media/*.go` for storage provider, storage bucket, media asset, media object, upload session, variant rule, asset link, and share link
- Create: `model/media/vars.go`
- Delete: corresponding root files
- Modify: media model consumers under `internal/logic` and `internal/svc`
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add a failing media ownership test**

Assert that all 16 custom/generated media files plus `vars.go` exist under `model/media`.

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./architecture -run TestMediaModelsLiveInMediaModule -count=1`

Expected: FAIL.

- [ ] **Step 2: Move the media files as one package**

Change all package declarations to `package media`, add local `ErrNotFound`, and replace local query helpers with `modelutil.UniquePositiveIDs` and `modelutil.InPlaceholders` in:

```text
assetlinkmodel.go
mediaassetmodel.go
mediaobjectmodel.go
storagebucketmodel.go
```

- [ ] **Step 3: Update consumers**

Import:

```go
mediamodel "discover_world/model/media"
```

Update all owned types, Model interfaces, and constructors without changing post/profile/account types in the same files.

- [ ] **Step 4: Verify and commit**

Run `gofmt`, full Go tests, and build. Expected: PASS. Commit explicit media and consumer paths with `refactor: move media models into module`.

### Task 7: Move Post and Forum Models

**Files:**
- Create: `model/post/{postmodel.go,postdiscussionmodel.go,commentrecordmodel.go,commentrecordmodel_gen.go,vars.go}`
- Create: `model/forum/{forumboardmodel.go,vars.go}`
- Delete: corresponding root files
- Modify: consumers under forum, moderation, post, profile, search, and `svc`
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add failing post/forum structure tests**

Assert exact ownership paths and run the focused architecture tests. Expected: FAIL.

- [ ] **Step 2: Move files and update helpers**

Use `package post` and `package forum`. Add local `vars.go` files. Update `postmodel.go` to use `modelutil.UniquePositiveIDs` and `modelutil.InPlaceholders`.

- [ ] **Step 3: Update imports and types**

Use:

```go
postmodel "discover_world/model/post"
forummodel "discover_world/model/forum"
```

Keep internal logic package aliases distinct, such as `postlogic`, so model and logic packages cannot be confused.

- [ ] **Step 4: Verify and commit**

Run formatting, architecture tests, all Go tests, and build. Expected: PASS. Commit with `refactor: move post and forum models into modules`.

### Task 8: Move Interaction, Taxonomy, and Statistics Models

**Files:**
- Create: `model/interaction/{reactionmodel.go,reactionmodel_gen.go,favoritemodel.go,favoritemodel_gen.go,vars.go}`
- Create: `model/taxonomy/{tagmodel.go,tagmodel_gen.go,taggingmodel.go,taggingmodel_gen.go,vars.go}`
- Create: `model/statistics/{entitystatmodel.go,entitystatmodel_gen.go,entitystathourlymodel.go,entityrankingmodel.go,sitestatsmodel.go,vars.go}`
- Delete: corresponding root files
- Modify: consumers and `architecture/backend_structure_test.go`

- [ ] **Step 1: Add failing ownership tests for all three modules**

Run focused architecture tests. Expected: FAIL before files move.

- [ ] **Step 2: Move interaction models**

Use `package interaction`, add `ErrNotFound`, and use `modelutil` helpers in reaction and favorite queries.

- [ ] **Step 3: Move taxonomy models**

Use `package taxonomy`, add `ErrNotFound`, and use `modelutil` helpers in tagging queries.

- [ ] **Step 4: Move statistics models**

Use `package statistics`, add `ErrNotFound`, and use `modelutil.InPlaceholders` in entity-stat queries.

- [ ] **Step 5: Update consumers and verify**

Use `interactionmodel`, `taxonomymodel`, and `statisticsmodel` import aliases. Run formatting, all tests, and build. Expected: PASS.

- [ ] **Step 6: Commit**

Commit explicit paths with `refactor: move interaction taxonomy and statistics models`.

### Task 9: Move Remaining Models

**Files:**
- Create: `model/moderation/*`
- Create: `model/notification/*`
- Create: `model/homepage/*`
- Create: `model/admin/*`
- Create: `model/search/*`
- Delete: corresponding root files
- Delete: `model/query_helpers.go` and root `model/vars.go` after no callers remain
- Modify: all remaining model consumers
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add failing ownership tests**

Assert these mappings:

```text
moderation: moderationreportmodel.go, contentipattributionmodel.go, vars.go
notification: notificationmodel.go, vars.go
homepage: siteconfigmodel.go, vars.go
admin: adminoperationlogmodel.go, adminrolepolicymodel.go, vars.go
search: searchmodel.go, vars.go
```

Run focused tests. Expected: FAIL.

- [ ] **Step 2: Move and rename packages**

Use package names matching each directory. Use `modelutil` in content-IP queries. Add local `ErrNotFound` aliases even for hand-written packages so error behavior stays consistent.

- [ ] **Step 3: Update all consumers**

Use aliases `moderationmodel`, `notificationmodel`, `homepagemodel`, `adminmodel`, and `searchmodel`. Update ServiceContext constructor references but leave its public fields flat until Task 10.

- [ ] **Step 4: Remove the root model package**

Run:

```bash
rg -n '"discover_world/model"' --glob '*.go'
find model -maxdepth 1 -type f -name '*.go'
```

Expected: neither command reports root-model consumers or root Go files. Delete obsolete `model/query_helpers.go` and `model/vars.go` only after this check.

- [ ] **Step 5: Verify and commit**

Run formatting, all tests, vet for `./model/...`, and build. Expected: PASS. Commit with `refactor: finish modular model ownership`.

### Task 10: Group Dependencies in ServiceContext ModelSet

**Files:**
- Modify: `internal/svc/servicecontext.go`
- Create: `internal/svc/models.go`
- Create: `internal/svc/models_{account,admin,follow,forum,homepage,interaction,media,moderation,notification,post,profile,search,statistics,taxonomy}.go`
- Create: `internal/svc/transaction.go`
- Modify: all `svcCtx.<ModelName>Model` consumers under `internal/`

- [ ] **Step 1: Add the failing ServiceContext shape test**

Create `internal/svc/models_test.go`:

```go
package svc

import "testing"

func TestModelSetContainsEveryModule(t *testing.T) {
	models := ModelSet{}
	_ = models.Account
	_ = models.Admin
	_ = models.Follow
	_ = models.Forum
	_ = models.Homepage
	_ = models.Interaction
	_ = models.Media
	_ = models.Moderation
	_ = models.Notification
	_ = models.Post
	_ = models.Profile
	_ = models.Search
	_ = models.Statistics
	_ = models.Taxonomy
}
```

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./internal/svc -run TestModelSetContainsEveryModule -count=1`

Expected: FAIL because `ModelSet` does not exist.

- [ ] **Step 2: Define ModelSet and module structs**

Each module file defines one struct and constructor. Example:

```go
type AccountModels struct {
	UserAccount accountmodel.UserAccountModel
}

func newAccountModels(conn sqlx.SqlConn) AccountModels {
	return AccountModels{
		UserAccount: accountmodel.NewUserAccountModel(conn),
	}
}
```

`models.go` defines the full `ModelSet` and:

```go
func newModelSet(conn sqlx.SqlConn) ModelSet {
	return ModelSet{
		Account:      newAccountModels(conn),
		Admin:        newAdminModels(conn),
		Follow:       newFollowModels(conn),
		Forum:        newForumModels(conn),
		Homepage:     newHomepageModels(conn),
		Interaction:  newInteractionModels(conn),
		Media:        newMediaModels(conn),
		Moderation:   newModerationModels(conn),
		Notification: newNotificationModels(conn),
		Post:         newPostModels(conn),
		Profile:      newProfileModels(conn),
		Search:       newSearchModels(conn),
		Statistics:   newStatisticsModels(conn),
		Taxonomy:     newTaxonomyModels(conn),
	}
}
```

- [ ] **Step 3: Simplify ServiceContext construction**

Replace all flat model fields with `Models ModelSet`. Both `NewServiceContext` and the transaction path must call `newModelSet(conn)`.

Move `Transact` and `withSession` to `transaction.go`; preserve config, Redis, middleware, resolver, and transaction connection semantics.

- [ ] **Step 4: Update every model field access**

Use the ownership table at the top of this plan. Examples:

```go
l.svcCtx.UserAccountModel     -> l.svcCtx.Models.Account.UserAccount
l.svcCtx.MediaAssetModel      -> l.svcCtx.Models.Media.MediaAsset
l.svcCtx.PostModel            -> l.svcCtx.Models.Post.Post
l.svcCtx.ReactionModel        -> l.svcCtx.Models.Interaction.Reaction
l.svcCtx.EntityRankingModel   -> l.svcCtx.Models.Statistics.EntityRanking
l.svcCtx.AdminOperationLogModel -> l.svcCtx.Models.Admin.AdminOperationLog
```

Run:

```bash
rg -n 'svcCtx\.[A-Z][A-Za-z]+Model|ctx\.[A-Z][A-Za-z]+Model' internal --glob '*.go'
```

Expected: no flat model access remains.

- [ ] **Step 5: Update main ranking dependency**

In `discoverworld.go`, pass `ctx.Models.Statistics.EntityRanking` to the ranking refresher.

- [ ] **Step 6: Verify and commit**

Run `gofmt`, `go test ./internal/svc ./internal/logic/... ./...`, `go vet ./internal/svc ./internal/logic/...`, and `go build ./...` with the temporary GOCACHE. Expected: PASS.

Commit with `refactor: group service dependencies by module` using explicit backend paths.

### Task 11: Move Non-route Logic Into Common Packages

**Files:**
- Move: `internal/logic/access/*` -> `internal/common/access/*`
- Move: reusable files from `internal/logic/ipgeo/*` -> `internal/common/ipgeo/*`
- Move: `internal/logic/adminsupport/*` -> `internal/common/adminsupport/*`
- Modify: all importers
- Modify: `architecture/backend_structure_test.go`

- [ ] **Step 1: Add failing common-boundary assertions**

Add tests requiring the three common directories and rejecting imports from `internal/common` back into `internal/logic`.

The import scan must parse Go files with `go/parser` in `parser.ImportsOnly` mode and fail when an import path under `internal/common` starts with `discover_world/internal/logic/`.

Run: `GOCACHE=/tmp/discover-world-go-cache go test ./architecture -run TestCommonPackagesDoNotDependOnLogic -count=1`

Expected: FAIL until imports and directories are corrected.

- [ ] **Step 2: Move access and admin support code**

Rename packages to `access` and `adminsupport`; update all consumers to:

```go
"discover_world/internal/common/access"
"discover_world/internal/common/adminsupport"
```

- [ ] **Step 3: Consolidate IP geo support without creating a `svc <-> ipgeo` cycle**

Move attribution helpers into `internal/common/ipgeo/attribution.go`, but remove their dependency on `*svc.ServiceContext`. The common package is already imported by `svc`, so importing `svc` back from this file would recreate a cycle.

Use dependency parameters instead:

```go
func RecordContentAttribution(
	ctx context.Context,
	enabled bool,
	resolver Resolver,
	hashSecret string,
	store moderationmodel.ContentIpAttributionModel,
	targetType string,
	targetID uint64,
	actionType string,
	userID uint64,
) error

func LoadRegionsByTarget(
	ctx context.Context,
	store moderationmodel.ContentIpAttributionModel,
	targetType string,
	targetIDs []uint64,
) (map[uint64]types.IpRegionResponse, error)
```

Callers pass `svcCtx.Config.IpGeo.Enabled`, `svcCtx.IpGeoResolver`, `svcCtx.Config.IpGeo.HashSecret`, and `svcCtx.Models.Moderation.ContentIpAttribution`. Remove the obsolete `internal/logic/ipgeo` package after all callers use the common package.

- [ ] **Step 4: Verify dependency direction**

Run:

```bash
rg -n 'internal/logic/(access|adminsupport|ipgeo)' --glob '*.go'
GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./...
GOCACHE=/tmp/discover-world-go-cache go build ./...
```

Expected: no obsolete imports and all commands pass.

- [ ] **Step 5: Commit**

Commit explicit common, removed logic directories, and importer paths with `refactor: move shared logic into common packages`.

### Task 12: Enforce Final Architecture and Generator Reproducibility

**Files:**
- Modify: `architecture/backend_structure_test.go`
- Modify: `api/modular_structure_test.go`

- [ ] **Step 1: Add final model import-boundary tests**

Use Go AST imports to enforce:

```text
model/** must not import discover_world/internal/**
model/** must not import discover_world/model/<another-feature-module>
no model/gen directory
no root model/*.go files
```

Allow only `discover_world/model/internal/modelutil` as an internal model helper import.

- [ ] **Step 2: Add handler-to-logic ownership tests**

For every file under `internal/handler/<module>`, reject imports of `discover_world/internal/logic/<different-module>`. Exclude `internal/handler/routes.go`, which imports handlers rather than logic.

- [ ] **Step 3: Add generated routes/types comparison test**

In `api/modular_structure_test.go`:

1. create `t.TempDir()`;
2. write `go.mod` containing `module discover_world` and `go 1.26`;
3. execute `goctl api go --api <absolute discover_world.api> --dir <temp> --style gozero`;
4. compare generated `internal/handler/routes.go` and `internal/types/types.go` byte-for-byte with repository files.

Normalize only line endings; do not hide semantic differences.

- [ ] **Step 4: Verify RED against any stale generated output, regenerate, then verify GREEN**

Run:

```bash
GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./api -count=1
goctl api go --api api/discover_world.api --dir . --style gozero
GOCACHE=/tmp/discover-world-go-cache go test ./architecture ./api -count=1
```

Expected: the first run identifies stale output if present; after regeneration all tests pass.

- [ ] **Step 5: Commit**

Commit architecture/API tests and regenerated files with `test: enforce backend module boundaries`.

### Task 13: Full Verification and Documentation Check

**Files:**
- Modify only documentation paths that still mention obsolete model, entrypoint, or config locations

- [ ] **Step 1: Search for obsolete paths and imports**

Run:

```bash
rg -n 'model/gen|"discover_world/model"|internal/logic/(access|adminsupport|ipgeo)|etc/application.yaml|\bmain.go\b' --glob '!frontend/**'
find model -maxdepth 1 -type f -name '*.go'
```

Expected: only historical explanation in the approved design document may mention the old paths; no source import or active operational documentation uses them.

- [ ] **Step 2: Validate every API module**

Run:

```bash
goctl api validate --api api/discover_world.api
for file in api/modules/*.api; do
  if [ "$(basename "$file")" != "common.api" ]; then
    goctl api validate --api "$file"
  fi
done
```

Expected: every command prints `api format ok`.

- [ ] **Step 3: Run complete Go verification**

Run:

```bash
GOCACHE=/tmp/discover-world-go-cache go test ./... -count=1
GOCACHE=/tmp/discover-world-go-cache go vet ./...
GOCACHE=/tmp/discover-world-go-cache go build ./...
git diff --check
git diff --cached --check
```

Expected: all commands exit 0 with no import cycle, vet error, build error, or whitespace error.

- [ ] **Step 4: Confirm frontend scope was preserved**

Run:

```bash
git diff --name-only -- frontend
git diff --cached --name-only -- frontend
```

Expected: only frontend changes that existed before this plan started are present; this implementation adds no new frontend path.

- [ ] **Step 5: Review final status and commit documentation-only corrections**

Use explicit paths and commit message `docs: update modular backend paths` only if active documentation required corrections. Do not stage unrelated pre-existing work.

## Completion Criteria

- `go test ./...`, `go vet ./...`, and `go build ./...` pass.
- `model/gen` and root `model/*.go` no longer exist.
- Every model lives in its approved business package with generated/custom code colocated.
- ServiceContext exposes models only through `Models.<Module>.<Model>`.
- `internal/handler/routes.go` is fully reproducible from API middleware declarations.
- Direct `goctl api go --api api/discover_world.api --dir . --style gozero` creates no duplicate entrypoint/config files.
- Public API, JSON contracts, database schema, and business behavior remain unchanged.
- No new frontend changes are introduced.
