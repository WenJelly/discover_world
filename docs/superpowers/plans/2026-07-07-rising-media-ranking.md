# Rising Media Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real backend-driven `rising` ranking for the Discover page's `排名上升` tab.

**Architecture:** Keep `/api/media/list/cursor` as the single media feed endpoint and add `sort: "rising"`. Add an hourly aggregate table/model so ranking can compare recent interaction velocity instead of total lifetime engagement. Keep frontend ordering stable by preserving backend order for the rising tab.

**Tech Stack:** Go/go-zero backend, MySQL SQL expressions, React/Vite frontend, Node test runner, Go tests.

---

### Task 1: Ranking Contract Tests

**Files:**
- Modify: `model/mediaasset_hot_test.go`
- Modify: `internal/logic/media/media_common_test.go`
- Modify: `frontend/tests/discover-sorting.test.ts`
- Modify: `frontend/tests/discover-route-ui.test.ts`

- [ ] Add tests that assert `rising` is an accepted media cursor sort.
- [ ] Add tests that assert rising score SQL reads `entity_stat_hourly`, compares a recent and previous window, uses weighted engagement, and applies a confidence term.
- [ ] Add tests that assert rising cursor pagination uses `risingScore + id` tie-breaking.
- [ ] Add frontend source tests that assert the `排名上升` tab requests `sort: "rising"` and preserves backend order.
- [ ] Run targeted tests and confirm they fail because `rising` is not implemented yet.

### Task 2: Backend Ranking Implementation

**Files:**
- Modify: `internal/logic/media/common.go`
- Modify: `internal/logic/media/getmediaassetcursorlistlogic.go`
- Modify: `model/mediaassetmodel.go`

- [ ] Add `mediaCursorSortRising = "rising"`.
- [ ] Extend `normalizeMediaCursorSort` to accept `rising`.
- [ ] Add rising cursor encode/decode helpers using `id`, `risingScore`, and `sort`.
- [ ] Add `mediaRisingScoreSQL`, `FindByWhereBeforeRisingScore`, `FindRisingScoreByID`, and `appendRisingCursorWhere`.
- [ ] Route `sort == "rising"` through the new model methods.

### Task 3: Hourly Stat Aggregation

**Files:**
- Create: `model/entitystathourlymodel.go`
- Modify: `internal/svc/servicecontext.go`
- Modify: `internal/logic/media/getmediaassetlogic.go`
- Modify: `internal/logic/media/togglemediareactionlogic.go`

- [ ] Add `EntityStatHourlyModel.IncrementCounter` that upserts the current hour bucket for supported counters.
- [ ] Register the model in normal and transactional `ServiceContext`.
- [ ] Increment hourly `view_count` when a media detail view increments total views.
- [ ] Increment hourly `reaction_count` when media reactions are toggled; negative deltas are ignored for rising velocity so unlikes do not rewrite past positive activity.

### Task 4: Frontend Wiring

**Files:**
- Modify: `frontend/src/pages/DiscoverPage.tsx`
- Modify: `frontend/src/lib/discover.ts`

- [ ] Map `discoverState.tab === "upcoming"` to backend sort `rising`.
- [ ] Preserve backend order for `upcoming`, matching the existing `hot` behavior.

### Task 5: Database Documentation

**Files:**
- Modify: `docs/数据库信息.md`
- Modify: `docs/后端功能与逻辑说明.md`

- [ ] Add a clearly marked database-change section for `entity_stat_hourly`.
- [ ] Document columns, unique key, and query indexes.
- [ ] Note that this document change is DDL guidance only; it is not executed by this implementation.
- [ ] Document the media ranking behavior: `hot` is lifetime weighted heat, `rising` is recent velocity.

### Task 6: Verification

**Files:**
- Verify all changed code and docs.

- [ ] Run backend focused tests: `go test ./model ./internal/logic/media ./internal/svc`.
- [ ] Run frontend focused tests: `cd frontend && node --experimental-strip-types --test tests/discover-sorting.test.ts tests/discover-route-ui.test.ts`.
- [ ] Run `go test ./...`.
- [ ] Run `cd frontend && npm test`.
