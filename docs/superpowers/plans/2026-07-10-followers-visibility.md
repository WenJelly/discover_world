# 粉丝可见权限完善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `followers` visibility for posts and work media without leaking followers-only content through public lists, search, downloads, or post image attachments.

**Architecture:** Add a small shared access policy package for owner/admin/follower visibility decisions, then replace boolean profile visibility with explicit access levels for post/media queries. Keep public discovery/search endpoints public-only, and extend authenticated profile and following-feed paths to include followers-only content where the viewer follows the author.

**Tech Stack:** Go, go-zero REST, sqlx/MySQL models, existing `user_follow` model, Go unit/source tests.

---

### Task 1: Shared Visibility Policy

**Files:**
- Create: `internal/logic/access/visibility.go`
- Test: `internal/logic/access/visibility_test.go`

- [ ] **Step 1: Write the failing test**

Create `internal/logic/access/visibility_test.go`:

```go
package access

import "testing"

func TestCanViewVisibility(t *testing.T) {
	tests := []struct {
		name       string
		visibility string
		level      ViewerAccessLevel
		want       bool
	}{
		{name: "anonymous sees public", visibility: VisibilityPublic, level: ViewerAccessPublic, want: true},
		{name: "anonymous cannot see followers", visibility: VisibilityFollowers, level: ViewerAccessPublic, want: false},
		{name: "follower sees followers", visibility: VisibilityFollowers, level: ViewerAccessFollower, want: true},
		{name: "follower cannot see private", visibility: VisibilityPrivate, level: ViewerAccessFollower, want: false},
		{name: "owner sees private", visibility: VisibilityPrivate, level: ViewerAccessOwner, want: true},
		{name: "admin sees unlisted", visibility: VisibilityUnlisted, level: ViewerAccessAdmin, want: true},
		{name: "unknown acts private", visibility: "weird", level: ViewerAccessFollower, want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanViewVisibility(tt.visibility, tt.level); got != tt.want {
				t.Fatalf("CanViewVisibility(%q, %q) = %v, want %v", tt.visibility, tt.level, got, tt.want)
			}
		})
	}
}

func TestVisibilitySQLForAccessLevel(t *testing.T) {
	tests := []struct {
		level ViewerAccessLevel
		want  []string
	}{
		{level: ViewerAccessPublic, want: []string{VisibilityPublic}},
		{level: ViewerAccessFollower, want: []string{VisibilityPublic, VisibilityFollowers}},
		{level: ViewerAccessOwner, want: []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}},
		{level: ViewerAccessAdmin, want: []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}},
	}
	for _, tt := range tests {
		got := VisibleValuesForLevel(tt.level)
		if len(got) != len(tt.want) {
			t.Fatalf("VisibleValuesForLevel(%q) length = %d, want %d", tt.level, len(got), len(tt.want))
		}
		for i := range tt.want {
			if got[i] != tt.want[i] {
				t.Fatalf("VisibleValuesForLevel(%q)[%d] = %q, want %q", tt.level, i, got[i], tt.want[i])
			}
		}
	}
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
go test ./internal/logic/access -count=1
```

Expected: FAIL with `package discover_world/internal/logic/access is not in std` or undefined symbols because the package does not exist.

- [ ] **Step 3: Implement the policy package**

Create `internal/logic/access/visibility.go`:

```go
package access

import (
	"context"
	"strings"

	"discover_world/internal/svc"
	"discover_world/model"
)

const (
	VisibilityPublic    = "public"
	VisibilityFollowers = "followers"
	VisibilityPrivate   = "private"
	VisibilityUnlisted  = "unlisted"
)

type ViewerAccessLevel string

const (
	ViewerAccessPublic   ViewerAccessLevel = "public"
	ViewerAccessFollower ViewerAccessLevel = "follower"
	ViewerAccessOwner    ViewerAccessLevel = "owner"
	ViewerAccessAdmin    ViewerAccessLevel = "admin"
)

func ResolveViewerAccess(ctx context.Context, svcCtx *svc.ServiceContext, viewer *model.UserAccount, ownerID uint64) (ViewerAccessLevel, error) {
	if viewer == nil || viewer.Id == 0 || ownerID == 0 {
		return ViewerAccessPublic, nil
	}
	if svcCtx != nil && svcCtx.IsAdminAccount(viewer) {
		return ViewerAccessAdmin, nil
	}
	if viewer.Id == ownerID {
		return ViewerAccessOwner, nil
	}
	if svcCtx == nil || svcCtx.UserFollowModel == nil {
		return ViewerAccessPublic, nil
	}
	isFollowing, err := svcCtx.UserFollowModel.IsFollowing(ctx, viewer.Id, ownerID)
	if err != nil {
		return ViewerAccessPublic, err
	}
	if isFollowing {
		return ViewerAccessFollower, nil
	}
	return ViewerAccessPublic, nil
}

func CanViewVisibility(visibility string, level ViewerAccessLevel) bool {
	switch strings.ToLower(strings.TrimSpace(visibility)) {
	case VisibilityPublic:
		return true
	case VisibilityFollowers:
		return level == ViewerAccessFollower || level == ViewerAccessOwner || level == ViewerAccessAdmin
	case VisibilityPrivate, VisibilityUnlisted:
		return level == ViewerAccessOwner || level == ViewerAccessAdmin
	default:
		return level == ViewerAccessOwner || level == ViewerAccessAdmin
	}
}

func VisibleValuesForLevel(level ViewerAccessLevel) []string {
	switch level {
	case ViewerAccessAdmin, ViewerAccessOwner:
		return []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}
	case ViewerAccessFollower:
		return []string{VisibilityPublic, VisibilityFollowers}
	default:
		return []string{VisibilityPublic}
	}
}
```

- [ ] **Step 4: Run the access tests**

Run:

```bash
go test ./internal/logic/access -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/logic/access/visibility.go internal/logic/access/visibility_test.go
git commit -m "feat: add shared content visibility policy"
```

### Task 2: Post Visibility Enablement

**Files:**
- Modify: `internal/logic/post/common.go`
- Modify: `internal/logic/post/common_test.go`
- Test: `internal/logic/post/followers_visibility_source_test.go`

- [ ] **Step 1: Write failing tests**

Update `internal/logic/post/common_test.go` so the visibility test accepts followers:

```go
func TestNormalizePostVisibilityAllowsPublicFollowersAndPrivate(t *testing.T) {
	tests := []struct {
		raw  string
		want string
	}{
		{raw: "", want: postVisibilityPublic},
		{raw: "public", want: postVisibilityPublic},
		{raw: "PUBLIC", want: postVisibilityPublic},
		{raw: "followers", want: postVisibilityFollowers},
		{raw: "FOLLOWERS", want: postVisibilityFollowers},
		{raw: "private", want: postVisibilityPrivate},
	}
	for _, tt := range tests {
		got, err := normalizePostVisibility(tt.raw)
		if err != nil {
			t.Fatalf("normalizePostVisibility(%q) returned error: %v", tt.raw, err)
		}
		if got != tt.want {
			t.Fatalf("normalizePostVisibility(%q) = %q, want %q", tt.raw, got, tt.want)
		}
	}
	if _, err := normalizePostVisibility("unlisted"); err == nil {
		t.Fatal("normalizePostVisibility accepted unsupported unlisted visibility")
	}
}
```

Create `internal/logic/post/followers_visibility_source_test.go`:

```go
package post

import (
	"os"
	"strings"
	"testing"
)

func TestPostFollowersVisibilityUsesSharedAccessPolicy(t *testing.T) {
	source, err := os.ReadFile("common.go")
	if err != nil {
		t.Fatalf("read common.go: %v", err)
	}
	text := string(source)
	required := []string{
		`postVisibilityFollowers = "followers"`,
		`access.ResolveViewerAccess`,
		`access.CanViewVisibility`,
		`visibility must be public, followers or private`,
		`postVisibility == postVisibilityFollowers`,
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("common.go missing %q", item)
		}
	}
}
```

- [ ] **Step 2: Run the failing post tests**

Run:

```bash
go test ./internal/logic/post -run 'NormalizePostVisibility|PostFollowersVisibility' -count=1
```

Expected: FAIL because `postVisibilityFollowers` and shared access usage are missing.

- [ ] **Step 3: Implement post visibility changes**

In `internal/logic/post/common.go`, add the import:

```go
access "discover_world/internal/logic/access"
```

Update constants:

```go
postVisibilityPublic    = "public"
postVisibilityFollowers = "followers"
postVisibilityPrivate   = "private"
```

Update `normalizePostVisibility`:

```go
func normalizePostVisibility(visibility string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(visibility)) {
	case "", postVisibilityPublic:
		return postVisibilityPublic, nil
	case postVisibilityFollowers:
		return postVisibilityFollowers, nil
	case postVisibilityPrivate:
		return postVisibilityPrivate, nil
	default:
		return "", commonresponse.BadRequest("visibility must be public, followers or private")
	}
}
```

Update `canViewPost`:

```go
func canViewPost(post *model.Post, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if post == nil || post.Status != postStatusActive || post.DeletedAt.Valid {
		return false
	}
	level, err := access.ResolveViewerAccess(context.Background(), svcCtx, user, post.UserId)
	if err != nil {
		return false
	}
	return access.CanViewVisibility(post.Visibility, level)
}
```

Update `validatePostImages` so public and followers posts enforce image visibility:

```go
if postVisibility == postVisibilityPublic && (asset.Visibility != postVisibilityPublic || asset.AuditStatus != "approved") {
	return commonresponse.BadRequest("public posts can only use public approved images")
}
if postVisibility == postVisibilityFollowers {
	if asset.Visibility != postVisibilityPublic && asset.Visibility != postVisibilityFollowers {
		return commonresponse.BadRequest("followers posts can only use public or followers images")
	}
	if asset.AuditStatus != "approved" {
		return commonresponse.BadRequest("followers posts can only use approved images")
	}
}
```

- [ ] **Step 4: Run the focused post tests**

Run:

```bash
go test ./internal/logic/post -run 'NormalizePostVisibility|PostFollowersVisibility' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/logic/post/common.go internal/logic/post/common_test.go internal/logic/post/followers_visibility_source_test.go
git commit -m "feat: enable followers visibility for posts"
```

### Task 3: Media Detail and Download Permissions

**Files:**
- Modify: `internal/logic/media/view.go`
- Test: `internal/logic/media/media_followers_visibility_source_test.go`

- [ ] **Step 1: Write the failing source test**

Create `internal/logic/media/media_followers_visibility_source_test.go`:

```go
package media

import (
	"os"
	"strings"
	"testing"
)

func TestMediaViewUsesSharedAccessPolicy(t *testing.T) {
	source, err := os.ReadFile("view.go")
	if err != nil {
		t.Fatalf("read view.go: %v", err)
	}
	text := string(source)
	required := []string{
		`access.ResolveViewerAccess`,
		`access.CanViewVisibility`,
		`asset.Status != "active"`,
		`asset.AuditStatus != "approved"`,
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("view.go missing %q", item)
		}
	}
}
```

- [ ] **Step 2: Run the failing media test**

Run:

```bash
go test ./internal/logic/media -run MediaViewUsesSharedAccessPolicy -count=1
```

Expected: FAIL because media view still hardcodes public or owner/admin.

- [ ] **Step 3: Implement media permission changes**

In `internal/logic/media/view.go`, add:

```go
access "discover_world/internal/logic/access"
```

Replace `canViewMediaAsset`:

```go
func canViewMediaAsset(asset *model.MediaAsset, user *model.UserAccount, svcCtx *svc.ServiceContext) bool {
	if asset == nil || asset.Status != "active" || asset.AuditStatus != "approved" || asset.DeletedAt.Valid {
		return false
	}
	level, err := access.ResolveViewerAccess(context.Background(), svcCtx, user, asset.OwnerUserId)
	if err != nil {
		return false
	}
	return access.CanViewVisibility(asset.Visibility, level)
}
```

Keep `canViewOriginal` delegating to `canViewMediaAsset`.

- [ ] **Step 4: Run media tests**

Run:

```bash
go test ./internal/logic/media -run 'MediaViewUsesSharedAccessPolicy|DownloadMediaAsset' -count=1
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/logic/media/view.go internal/logic/media/media_followers_visibility_source_test.go
git commit -m "feat: enforce followers visibility for media access"
```

### Task 4: Profile Post List Access Levels

**Files:**
- Modify: `model/postmodel.go`
- Modify: `model/postmodel_test.go`
- Modify: `internal/logic/profile/common.go`
- Modify: `internal/logic/profile/getprofilepostcursorlistlogic.go`
- Test: `internal/logic/profile/profile_followers_visibility_source_test.go`

- [ ] **Step 1: Write failing source tests**

Create `internal/logic/profile/profile_followers_visibility_source_test.go`:

```go
package profile

import (
	"os"
	"strings"
	"testing"
)

func TestProfilePostListUsesAccessLevel(t *testing.T) {
	commonSource, err := os.ReadFile("common.go")
	if err != nil {
		t.Fatalf("read common.go: %v", err)
	}
	listSource, err := os.ReadFile("getprofilepostcursorlistlogic.go")
	if err != nil {
		t.Fatalf("read list logic: %v", err)
	}
	if !strings.Contains(string(commonSource), "ResolveViewerAccess") {
		t.Fatal("common.go should resolve viewer access for target profile")
	}
	if strings.Contains(string(commonSource), "includePrivate := target.Id == loginUser.Id") {
		t.Fatal("loadProfileTarget should not return boolean includePrivate")
	}
	if !strings.Contains(string(listSource), "FindByUserBeforePinCursor") || !strings.Contains(string(listSource), "accessLevel") {
		t.Fatal("profile post list should pass accessLevel into post model query")
	}
}
```

Update `model/postmodel_test.go` with a source assertion:

```go
func TestPostModelProfileQuerySupportsFollowersVisibility(t *testing.T) {
	source, err := os.ReadFile("postmodel.go")
	if err != nil {
		t.Fatalf("read postmodel.go: %v", err)
	}
	text := string(source)
	required := []string{
		"FindByUserBeforePinCursor(ctx context.Context, userID uint64, visibleValues []string",
		"`visibility` in (",
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("postmodel.go missing %q", item)
		}
	}
}
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
go test ./model ./internal/logic/profile -run 'PostModelProfileQuerySupportsFollowersVisibility|ProfilePostListUsesAccessLevel' -count=1
```

Expected: FAIL because profile still uses `includePrivate bool`.

- [ ] **Step 3: Change post model profile query signature**

In `model/postmodel.go`, change interface methods:

```go
FindByUserBeforeID(ctx context.Context, userID uint64, visibleValues []string, beforeID, limit int64) ([]*Post, error)
FindByUserBeforePinCursor(ctx context.Context, userID uint64, visibleValues []string, cursor PostPinCursor, limit int64) ([]*Post, error)
```

Build the visibility condition:

```go
visibleValues = normalizeVisibleValues(visibleValues)
conditions := []string{"`user_id` = ?", "`status` <> 'deleted'", "`deleted_at` is null"}
args := []any{userID}
if len(visibleValues) > 0 {
	conditions = append(conditions, "`status` = 'active'", fmt.Sprintf("`visibility` in (%s)", inPlaceholders(len(visibleValues))))
	for _, visibility := range visibleValues {
		args = append(args, visibility)
	}
}
```

Add helper:

```go
func normalizeVisibleValues(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.ToLower(strings.TrimSpace(value))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}
```

- [ ] **Step 4: Change profile target loading**

In `internal/logic/profile/common.go`, import access package and change return:

```go
func loadProfileTarget(ctx context.Context, svcCtx *svc.ServiceContext, rawUserID string) (*model.UserAccount, *model.UserAccount, access.ViewerAccessLevel, error)
```

At the end:

```go
accessLevel, err := access.ResolveViewerAccess(ctx, svcCtx, loginUser, target.Id)
if err != nil {
	return nil, nil, access.ViewerAccessPublic, commonresponse.InternalServerError("查询关注关系失败")
}
return loginUser, target, accessLevel, nil
```

In `getprofilepostcursorlistlogic.go`, pass visible values:

```go
loginUser, target, accessLevel, err := loadProfileTarget(l.ctx, l.svcCtx, req.UserId)
...
visibleValues := access.VisibleValuesForLevel(accessLevel)
posts, err := l.svcCtx.PostModel.FindByUserBeforePinCursor(l.ctx, target.Id, visibleValues, cursor, pageSize+1)
```

- [ ] **Step 5: Keep album behavior public/private only**

In `getprofilealbumlistlogic.go`, adapt to the new `loadProfileTarget` return while preserving existing album semantics:

```go
loginUser, target, accessLevel, err := loadProfileTarget(l.ctx, l.svcCtx, req.UserId)
...
includePrivate := accessLevel == access.ViewerAccessOwner || accessLevel == access.ViewerAccessAdmin
```

- [ ] **Step 6: Run profile/model tests**

Run:

```bash
go test ./model ./internal/logic/profile -run 'PostModelProfileQuerySupportsFollowersVisibility|ProfilePostListUsesAccessLevel' -count=1
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add model/postmodel.go model/postmodel_test.go internal/logic/profile/common.go internal/logic/profile/getprofilepostcursorlistlogic.go internal/logic/profile/getprofilealbumlistlogic.go internal/logic/profile/profile_followers_visibility_source_test.go
git commit -m "feat: show followers posts on followed profiles"
```

### Task 5: Following Feed Includes Followers Content

**Files:**
- Modify: `model/postmodel.go`
- Modify: `model/mediaassetmodel.go`
- Modify: `model/following_feed_model_contract_test.go`
- Modify: `internal/logic/feed/getfollowingpostcursorlistlogic.go`
- Modify: `internal/logic/feed/getfollowingmediacursorlistlogic.go`
- Test: `internal/logic/feed/feed_followers_visibility_source_test.go`

- [ ] **Step 1: Write failing tests**

Update `model/following_feed_model_contract_test.go` to require both public and followers:

```go
func TestFollowingFeedQueriesIncludeFollowersVisibility(t *testing.T) {
	files := []string{"postmodel.go", "mediaassetmodel.go"}
	for _, file := range files {
		source, err := os.ReadFile(file)
		if err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		text := string(source)
		if !strings.Contains(text, "`visibility` in ('public','followers')") {
			t.Fatalf("%s should include public and followers visibility for following feed", file)
		}
	}
}
```

Create `internal/logic/feed/feed_followers_visibility_source_test.go`:

```go
package feed

import (
	"os"
	"strings"
	"testing"
)

func TestFollowingFeedsPassViewerToResponseBuilders(t *testing.T) {
	postSource, err := os.ReadFile("getfollowingpostcursorlistlogic.go")
	if err != nil {
		t.Fatalf("read post feed: %v", err)
	}
	mediaSource, err := os.ReadFile("getfollowingmediacursorlistlogic.go")
	if err != nil {
		t.Fatalf("read media feed: %v", err)
	}
	if !strings.Contains(string(postSource), "BuildPublicPostResponses(l.ctx, l.svcCtx, posts, loginUser)") {
		t.Fatal("following post feed must pass loginUser to response builder")
	}
	if !strings.Contains(string(mediaSource), "BuildMediaAssetListResponse(l.ctx, l.svcCtx, assets, loginUser") {
		t.Fatal("following media feed must pass loginUser to response builder")
	}
}
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
go test ./model ./internal/logic/feed -run 'FollowingFeedQueriesIncludeFollowersVisibility|FollowingFeedsPassViewer' -count=1
```

Expected: FAIL because model following-feed queries still use `visibility = 'public'`.

- [ ] **Step 3: Update following post query**

In `model/postmodel.go`, update `FindPublicByAuthorsBeforeCursor` conditions:

```go
conditions := []string{
	fmt.Sprintf("`user_id` in (%s)", inPlaceholders(len(authorIDs))),
	"`status` = 'active'",
	"`visibility` in ('public','followers')",
	"`deleted_at` is null",
}
```

- [ ] **Step 4: Update following media query**

In `model/mediaassetmodel.go`, update `FindPublicWorkByOwnersBeforeID` conditions:

```go
conditions := []string{
	fmt.Sprintf("`owner_user_id` in (%s)", inPlaceholders(len(ownerIDs))),
	"`status` = 'active'",
	"`visibility` in ('public','followers')",
	"`audit_status` = 'approved'",
	"`asset_usage` = 'work'",
	"`deleted_at` is null",
}
```

- [ ] **Step 5: Run following feed tests**

Run:

```bash
go test ./model ./internal/logic/feed -run 'FollowingFeedQueriesIncludeFollowersVisibility|FollowingFeedsPassViewer' -count=1
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add model/postmodel.go model/mediaassetmodel.go model/following_feed_model_contract_test.go internal/logic/feed/getfollowingpostcursorlistlogic.go internal/logic/feed/getfollowingmediacursorlistlogic.go internal/logic/feed/feed_followers_visibility_source_test.go
git commit -m "feat: include followers content in following feeds"
```

### Task 6: Keep Public Lists and Search Public-Only

**Files:**
- Modify: `internal/logic/search/search_contract_test.go`
- Modify: `model/mediaassetmodel_test.go`
- Modify: `model/community_model_contract_test.go`
- Modify: `model/searchmodel.go` only if tests reveal drift
- Modify: `internal/logic/media/query.go` only if tests reveal drift

- [ ] **Step 1: Add public-only guard tests**

In `internal/logic/search/search_contract_test.go`, add:

```go
func TestGlobalSearchRemainsPublicOnly(t *testing.T) {
	source, err := os.ReadFile("../../model/searchmodel.go")
	if err != nil {
		t.Fatalf("read searchmodel.go: %v", err)
	}
	text := string(source)
	required := []string{
		"ma.`+\"`visibility`\"+` = 'public'",
		"p.`+\"`visibility`\"+` = 'public'",
		"a.`+\"`visibility`\"+` = 'public'",
	}
	for _, item := range required {
		if !strings.Contains(text, item) {
			t.Fatalf("searchmodel.go missing public-only guard %q", item)
		}
	}
	if strings.Contains(text, "followers") {
		t.Fatal("global search should not include followers visibility")
	}
}
```

In `model/mediaassetmodel_test.go`, keep or add a guard that public gallery queries contain:

```go
"`visibility` = 'public'"
```

In `model/community_model_contract_test.go`, keep or add a guard that public post list queries contain:

```go
"p.`visibility` = 'public'"
```

- [ ] **Step 2: Run public-only tests**

Run:

```bash
go test ./model ./internal/logic/search -run 'Public|GlobalSearchRemainsPublicOnly|Community' -count=1
```

Expected: PASS. If it fails because a prior task accidentally expanded public endpoints, restore those queries to public-only.

- [ ] **Step 3: Commit**

```bash
git add internal/logic/search/search_contract_test.go model/mediaassetmodel_test.go model/community_model_contract_test.go model/searchmodel.go internal/logic/media/query.go
git commit -m "test: guard public endpoints from followers content"
```

### Task 7: Documentation and Full Verification

**Files:**
- Modify: `docs/数据库信息.md`
- Modify: `docs/后端功能与逻辑说明.md`
- Modify: `docs/媒体资源存储设计要点.md`

- [ ] **Step 1: Update database documentation**

In `docs/数据库信息.md`, replace the previous note that followers visibility is not enabled with:

```markdown
## 粉丝可见权限口径

`media_asset` 和 `post` 已启用 `visibility='followers'`：

- `public`：公开列表、公开搜索、详情均可见。
- `followers`：作者本人、管理员、已关注作者的登录用户可见。
- `private`：作者本人和管理员可见。
- `unlisted`：作者本人和管理员可见；分享链接能力尚未启用。

公开媒体列表、公开动态列表、全局搜索、首页精选和站点公开统计仍只包含
`visibility='public'` 内容。关注动态流和关注作品流包含当前登录用户已关注作者的
`public + followers` 内容。

`album.visibility='followers'` 仍是预留字段，第一期不启用相册粉丝可见。
```

- [ ] **Step 2: Update backend behavior docs**

In `docs/后端功能与逻辑说明.md`, document:

```markdown
粉丝可见内容读取统一经过访问策略：本人、管理员、已关注作者的用户可以读取
`followers` 动态和作品；公开列表和全局搜索不会返回 `followers` 内容。
```

- [ ] **Step 3: Update media design notes**

In `docs/媒体资源存储设计要点.md`, document:

```markdown
作品媒体 `visibility='followers'` 允许粉丝查看详情图、原图和下载；未关注用户访问详情或下载返回 403。
动态附件应跟随动态可见范围，避免动态正文是粉丝可见但附件媒体公开泄漏。
```

- [ ] **Step 4: Run full backend tests**

Run:

```bash
go test ./...
```

Expected: PASS.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: only intentional committed changes or no changes. Existing unrelated local files such as `etc/application.yaml` and untracked `sql/` must not be staged unless the user explicitly includes them.

- [ ] **Step 6: Commit docs**

```bash
git add docs/数据库信息.md docs/后端功能与逻辑说明.md docs/媒体资源存储设计要点.md
git commit -m "docs: describe followers visibility permissions"
```
