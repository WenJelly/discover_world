// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package middleware

import (
	"net/http"
	"time"
)

type LoginRateLimitMiddleware struct {
	limiter *RateLimitMiddleware
}

func NewLoginRateLimitMiddleware(limiter rateLimiter, secret string, limit int64) *LoginRateLimitMiddleware {
	return &LoginRateLimitMiddleware{
		limiter: NewRateLimitMiddleware(limiter, secret, "login:ip", limit, 10*time.Minute),
	}
}

func (m *LoginRateLimitMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	if m == nil || m.limiter == nil {
		return next
	}
	return m.limiter.Handle(next)
}
