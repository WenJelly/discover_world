package ranking

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"discover_world/internal/redisx"
)

type fakeMediaRankingModel struct {
	batches []rankingBatch
	after   []uint64
	limits  []int64
	cleaned int
}

type rankingBatch struct {
	lastID uint64
	count  int64
	err    error
}

type fakeRankingLocker struct {
	acquired bool
	err      error
	released int
}

func (f *fakeRankingLocker) TryLock(context.Context, string, time.Duration) (redisx.ReleaseFunc, bool, error) {
	return redisx.ReleaseFunc(func(context.Context) error {
		f.released++
		return nil
	}), f.acquired, f.err
}

func (f *fakeMediaRankingModel) RefreshMediaBatch(_ context.Context, afterID uint64, limit int64) (uint64, int64, error) {
	f.after = append(f.after, afterID)
	f.limits = append(f.limits, limit)
	batch := f.batches[0]
	f.batches = f.batches[1:]
	return batch.lastID, batch.count, batch.err
}

func (f *fakeMediaRankingModel) DeleteStaleMediaRankings(context.Context) error {
	f.cleaned++
	return nil
}

func TestRefreshAllMediaRankingsProcessesBoundedBatchesAndCleansStaleRows(t *testing.T) {
	model := &fakeMediaRankingModel{batches: []rankingBatch{
		{lastID: 100, count: 2},
		{lastID: 180, count: 2},
		{lastID: 180, count: 0},
	}}

	if err := refreshAllMediaRankings(context.Background(), model, 2); err != nil {
		t.Fatalf("refreshAllMediaRankings returned error: %v", err)
	}
	if !reflect.DeepEqual(model.after, []uint64{0, 100, 180}) {
		t.Fatalf("batch cursors = %#v, want [0 100 180]", model.after)
	}
	if !reflect.DeepEqual(model.limits, []int64{2, 2, 2}) {
		t.Fatalf("batch limits = %#v, want [2 2 2]", model.limits)
	}
	if model.cleaned != 1 {
		t.Fatalf("stale cleanup calls = %d, want 1", model.cleaned)
	}
}

func TestNormalizeRefreshSettingsRejectsUnboundedValues(t *testing.T) {
	interval, batch := normalizeRefreshSettings(0, 0)
	if interval.Seconds() != 3600 || batch != 1000 {
		t.Fatalf("defaults = (%s, %d), want (1h, 1000)", interval, batch)
	}

	interval, batch = normalizeRefreshSettings(1, 50000)
	if interval.Seconds() != 60 || batch != 5000 {
		t.Fatalf("bounded values = (%s, %d), want (1m, 5000)", interval, batch)
	}
}

func TestRefreshMediaRankingsWithLockSkipsWhenAnotherInstanceOwnsLock(t *testing.T) {
	model := &fakeMediaRankingModel{batches: []rankingBatch{{lastID: 0, count: 0}}}
	locker := &fakeRankingLocker{acquired: false}

	if err := refreshMediaRankingsWithLock(context.Background(), model, locker, time.Minute, 100); err != nil {
		t.Fatalf("refreshMediaRankingsWithLock returned error: %v", err)
	}
	if len(model.after) != 0 || locker.released != 0 {
		t.Fatalf("skipped refresh touched model or release: after=%v released=%d", model.after, locker.released)
	}
}

func TestRefreshMediaRankingsWithLockReleasesAfterRefreshAndReturnsLockErrors(t *testing.T) {
	model := &fakeMediaRankingModel{batches: []rankingBatch{{lastID: 0, count: 0}}}
	locker := &fakeRankingLocker{acquired: true}

	if err := refreshMediaRankingsWithLock(context.Background(), model, locker, time.Minute, 100); err != nil {
		t.Fatalf("refreshMediaRankingsWithLock returned error: %v", err)
	}
	if model.cleaned != 1 || locker.released != 1 {
		t.Fatalf("refresh result cleaned=%d released=%d", model.cleaned, locker.released)
	}

	lockErr := errors.New("redis down")
	if err := refreshMediaRankingsWithLock(context.Background(), model, &fakeRankingLocker{err: lockErr}, time.Minute, 100); !errors.Is(err, lockErr) {
		t.Fatalf("lock error = %v, want %v", err, lockErr)
	}
}
