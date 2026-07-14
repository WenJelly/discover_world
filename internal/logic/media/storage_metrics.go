package media

import (
	"strconv"
	"time"

	"github.com/zeromicro/go-zero/core/metric"
)

var (
	cosRequestDuration = metric.NewHistogramVec(&metric.HistogramVecOpts{
		Namespace: "discover_world",
		Subsystem: "cos_requests",
		Name:      "duration_ms",
		Help:      "COS request duration in milliseconds.",
		Labels:    []string{"operation", "result"},
		Buckets:   []float64{10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 30000},
	})
	cosRequestErrors = metric.NewCounterVec(&metric.CounterVecOpts{
		Namespace: "discover_world",
		Subsystem: "cos_requests",
		Name:      "error_total",
		Help:      "COS request errors.",
		Labels:    []string{"operation", "result"},
	})
)

func cosMetricResultCode(statusCode int, err error) string {
	if err != nil {
		return "transport_error"
	}
	if statusCode <= 0 {
		return "unknown"
	}
	return strconv.Itoa(statusCode)
}

func observeCOSRequest(operation string, startedAt time.Time, statusCode int, err error) {
	result := cosMetricResultCode(statusCode, err)
	cosRequestDuration.ObserveFloat(float64(time.Since(startedAt).Microseconds())/1000, operation, result)
	if err != nil || statusCode < 200 || statusCode >= 300 {
		cosRequestErrors.Inc(operation, result)
	}
}
