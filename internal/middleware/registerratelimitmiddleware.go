// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package middleware

import (
	"net/http"
	"time"
)

type RegisterRateLimitMiddleware struct {
	limiter *RateLimitMiddleware
}

func NewRegisterRateLimitMiddleware(limiter rateLimiter, secret string, limit int64) *RegisterRateLimitMiddleware {
	return &RegisterRateLimitMiddleware{
		limiter: NewRateLimitMiddleware(limiter, secret, "register:ip", limit, time.Hour),
	}
}

func (m *RegisterRateLimitMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	if m == nil || m.limiter == nil {
		return next
	}
	return m.limiter.Handle(next)
}
