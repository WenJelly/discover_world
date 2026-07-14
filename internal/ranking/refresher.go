package ranking

import (
	"context"
	"fmt"
	"time"

	"github.com/zeromicro/go-zero/core/logx"
)

type mediaRankingModel interface {
	RefreshMediaBatch(ctx context.Context, afterID uint64, limit int64) (lastID uint64, count int64, err error)
	DeleteStaleMediaRankings(ctx context.Context) error
}

func StartMediaRankingRefresher(parent context.Context, model mediaRankingModel, refreshIntervalSeconds, batchSize int64) (context.CancelFunc, <-chan struct{}) {
	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	interval, batchSize := normalizeRefreshSettings(refreshIntervalSeconds, batchSize)

	go func() {
		defer close(done)
		run := func() {
			if err := refreshAllMediaRankings(ctx, model, batchSize); err != nil && ctx.Err() == nil {
				logx.Errorf("refresh media rankings failed: %v", err)
			}
		}

		run()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				run()
			}
		}
	}()

	return cancel, done
}

func refreshAllMediaRankings(ctx context.Context, model mediaRankingModel, batchSize int64) error {
	if model == nil {
		return fmt.Errorf("media ranking model is nil")
	}

	afterID := uint64(0)
	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		lastID, count, err := model.RefreshMediaBatch(ctx, afterID, batchSize)
		if err != nil {
			return err
		}
		if count == 0 {
			break
		}
		if lastID <= afterID {
			return fmt.Errorf("media ranking refresh cursor did not advance: after=%d last=%d", afterID, lastID)
		}
		afterID = lastID
	}

	return model.DeleteStaleMediaRankings(ctx)
}

func normalizeRefreshSettings(refreshIntervalSeconds, batchSize int64) (time.Duration, int64) {
	if refreshIntervalSeconds <= 0 {
		refreshIntervalSeconds = 3600
	}
	if refreshIntervalSeconds < 60 {
		refreshIntervalSeconds = 60
	}
	if refreshIntervalSeconds > 86400 {
		refreshIntervalSeconds = 86400
	}
	if batchSize <= 0 {
		batchSize = 1000
	}
	if batchSize > 5000 {
		batchSize = 5000
	}
	return time.Duration(refreshIntervalSeconds) * time.Second, batchSize
}
