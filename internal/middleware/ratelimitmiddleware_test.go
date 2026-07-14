package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"discover_world/internal/common/clientip"
	"discover_world/internal/redisx"
)

type fakeRateLimiter struct {
	decision redisx.RateDecision
	err      error
	scope    string
	subject  string
}

func (f *fakeRateLimiter) Allow(_ context.Context, scope, subject string, _ int64, _ time.Duration) (redisx.RateDecision, error) {
	f.scope = scope
	f.subject = subject
	return f.decision, f.err
}

func TestRateLimitMiddlewareBlocksWith429AndRetryAfter(t *testing.T) {
	limiter := &fakeRateLimiter{decision: redisx.RateDecision{Allowed: false, RetryAfter: 42 * time.Second}}
	middleware := NewRateLimitMiddleware(limiter, "hash-secret", "login:ip", 20, 10*time.Minute).Handle
	nextCalled := false
	handler := middleware(func(http.ResponseWriter, *http.Request) { nextCalled = true })
	req := httptest.NewRequest(http.MethodPost, "/api/account/login", nil)
	req = req.WithContext(clientip.WithClientIP(req.Context(), netip.MustParseAddr("203.0.113.9")))
	recorder := httptest.NewRecorder()

	handler(recorder, req)

	if nextCalled {
		t.Fatal("blocked request reached next handler")
	}
	if recorder.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", recorder.Code)
	}
	if recorder.Header().Get("Retry-After") != "42" {
		t.Fatalf("Retry-After = %q", recorder.Header().Get("Retry-After"))
	}
	if limiter.scope != "login:ip" || limiter.subject == "203.0.113.9" || limiter.subject == "" {
		t.Fatalf("rate limit identity = (%q, %q)", limiter.scope, limiter.subject)
	}
}

func TestRateLimitMiddlewareAllowsAndFailsOpenOnRedisErrors(t *testing.T) {
	for _, limiter := range []*fakeRateLimiter{
		{decision: redisx.RateDecision{Allowed: true}},
		{err: errors.New("redis unavailable")},
	} {
		nextCalled := false
		handler := NewRateLimitMiddleware(limiter, "secret", "search:ip", 30, time.Minute).Handle(
			func(http.ResponseWriter, *http.Request) { nextCalled = true },
		)
		handler(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/search", nil))
		if !nextCalled {
			t.Fatalf("request did not fail open for limiter %#v", limiter)
		}
	}
}
