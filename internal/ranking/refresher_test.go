package ranking

import (
	"context"
	"reflect"
	"testing"
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
