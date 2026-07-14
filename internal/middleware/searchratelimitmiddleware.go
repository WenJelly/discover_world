// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package middleware

import (
	"net/http"
	"time"
)

type SearchRateLimitMiddleware struct {
	limiter *RateLimitMiddleware
}

func NewSearchRateLimitMiddleware(limiter rateLimiter, secret string, limit int64) *SearchRateLimitMiddleware {
	return &SearchRateLimitMiddleware{
		limiter: NewRateLimitMiddleware(limiter, secret, "search:ip", limit, time.Minute),
	}
}

func (m *SearchRateLimitMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	if m == nil || m.limiter == nil {
		return next
	}
	return m.limiter.Handle(next)
}
