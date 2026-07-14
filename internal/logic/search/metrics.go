package search

import (
	"time"

	"github.com/zeromicro/go-zero/core/metric"
)

var searchDuration = metric.NewHistogramVec(&metric.HistogramVecOpts{
	Namespace: "discover_world",
	Subsystem: "search",
	Name:      "duration_ms",
	Help:      "Global search duration by result type.",
	Labels:    []string{"type", "result"},
	Buckets:   []float64{1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2000, 5000},
})

func searchMetricResult(err error) string {
	if err != nil {
		return "error"
	}
	return "success"
}

func observeSearch(searchType string, startedAt time.Time, err error) {
	searchDuration.ObserveFloat(float64(time.Since(startedAt).Microseconds())/1000, searchType, searchMetricResult(err))
}
