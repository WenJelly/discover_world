package middleware

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"discover_world/internal/common/clientip"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/redisx"

	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/core/metric"
	"github.com/zeromicro/go-zero/rest/httpx"
)

type rateLimiter interface {
	Allow(ctx context.Context, scope, subject string, limit int64, window time.Duration) (redisx.RateDecision, error)
}

type RateLimitMiddleware struct {
	limiter rateLimiter
	secret  string
	scope   string
	limit   int64
	window  time.Duration
}

var rateLimitRequests = metric.NewCounterVec(&metric.CounterVecOpts{
	Namespace: "discover_world",
	Subsystem: "rate_limit",
	Name:      "requests_total",
	Help:      "Rate limit decisions by scope.",
	Labels:    []string{"scope", "result"},
})

func NewRateLimitMiddleware(limiter rateLimiter, secret, scope string, limit int64, window time.Duration) *RateLimitMiddleware {
	return &RateLimitMiddleware{
		limiter: limiter,
		secret:  secret,
		scope:   scope,
		limit:   limit,
		window:  window,
	}
}

func (m *RateLimitMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil || m.limiter == nil || m.limit <= 0 || m.window <= 0 {
			next(w, r)
			return
		}

		identity := "unknown"
		if addr, ok := clientip.FromContext(r.Context()); ok {
			identity = addr.String()
		}
		subject := redisx.HashSubject(m.secret, identity)
		decision, err := m.limiter.Allow(r.Context(), m.scope, subject, m.limit, m.window)
		if err != nil {
			rateLimitRequests.Inc(m.scope, "error")
			logx.WithContext(r.Context()).Errorf("redis rate limit failed open: scope=%s err=%v", m.scope, err)
			next(w, r)
			return
		}
		if decision.Allowed {
			rateLimitRequests.Inc(m.scope, "allowed")
			next(w, r)
			return
		}

		rateLimitRequests.Inc(m.scope, "blocked")
		retryAfter := int64(decision.RetryAfter.Seconds())
		if retryAfter <= 0 {
			retryAfter = 1
		}
		w.Header().Set("Retry-After", strconv.FormatInt(retryAfter, 10))
		statusCode, body := commonresponse.ErrorBody(commonresponse.TooManyRequests("请求过于频繁，请稍后重试"))
		httpx.WriteJsonCtx(r.Context(), w, statusCode, body)
	}
}
