package model

import (
	"context"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const mediaRankingBenchmarkWhere = "`status` = 'active' and `visibility` = 'public' and `audit_status` = 'approved' and `asset_usage` = 'work' and `deleted_at` is null"

func BenchmarkMediaRankingHotCursor(b *testing.B) {
	benchmarkMediaRankingCursor(b, "hot")
}

func BenchmarkMediaRankingRisingCursor(b *testing.B) {
	benchmarkMediaRankingCursor(b, "rising")
}

func benchmarkMediaRankingCursor(b *testing.B, sort string) {
	dsn := os.Getenv("DISCOVER_WORLD_BENCHMARK_MYSQL_DSN")
	if dsn == "" {
		b.Skip("set DISCOVER_WORLD_BENCHMARK_MYSQL_DSN to benchmark ranking queries")
	}

	model := NewMediaAssetModel(sqlx.NewMysql(dsn))
	ctx := context.Background()
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var err error
		if sort == "hot" {
			_, err = model.FindByWhereBeforeHotScore(ctx, mediaRankingBenchmarkWhere, 0, 0, 60)
		} else {
			_, err = model.FindByWhereBeforeRisingScore(ctx, mediaRankingBenchmarkWhere, 0, 0, 60)
		}
		if err != nil {
			b.Fatal(err)
		}
	}
}

func TestMediaRankingP95(t *testing.T) {
	dsn := os.Getenv("DISCOVER_WORLD_BENCHMARK_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set DISCOVER_WORLD_BENCHMARK_MYSQL_DSN to measure ranking P95")
	}

	model := NewMediaAssetModel(sqlx.NewMysql(dsn))
	ctx := context.Background()
	for _, rankingSort := range []string{"hot", "rising"} {
		t.Run(rankingSort, func(t *testing.T) {
			const samples = 200
			durations := make([]time.Duration, 0, samples)
			for i := 0; i < samples; i++ {
				startedAt := time.Now()
				var err error
				if rankingSort == "hot" {
					_, err = model.FindByWhereBeforeHotScore(ctx, mediaRankingBenchmarkWhere, 0, 0, 60)
				} else {
					_, err = model.FindByWhereBeforeRisingScore(ctx, mediaRankingBenchmarkWhere, 0, 0, 60)
				}
				if err != nil {
					t.Fatal(err)
				}
				durations = append(durations, time.Since(startedAt))
			}
			sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
			p95 := durations[(samples*95+99)/100-1]
			t.Logf("samples=%d p95=%s", samples, p95)
		})
	}
}
