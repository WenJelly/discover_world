package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

type fakeTokenRevocationChecker struct {
	revoked bool
	err     error
	tokenID string
}

func (f *fakeTokenRevocationChecker) IsTokenRevoked(_ context.Context, tokenID string) (bool, error) {
	f.tokenID = tokenID
	return f.revoked, f.err
}

func signedTokenForMiddleware(t *testing.T, secret, tokenID string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": "1",
		"jti":    tokenID,
		"exp":    time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestTokenRevocationMiddlewareRejectsRevokedTokens(t *testing.T) {
	checker := &fakeTokenRevocationChecker{revoked: true}
	nextCalled := false
	handler := NewTokenRevocationMiddleware(checker, "secret").Handle(func(http.ResponseWriter, *http.Request) {
		nextCalled = true
	})
	req := httptest.NewRequest(http.MethodPost, "/api/account/detail", nil)
	req.Header.Set("Authorization", "Bearer "+signedTokenForMiddleware(t, "secret", "session-1"))
	recorder := httptest.NewRecorder()

	handler(recorder, req)

	if nextCalled || recorder.Code != http.StatusUnauthorized || checker.tokenID != "session-1" {
		t.Fatalf("revoked result: called=%v status=%d tokenID=%q", nextCalled, recorder.Code, checker.tokenID)
	}
}

func TestTokenRevocationMiddlewareFailsClosedWhenRedisIsUnavailable(t *testing.T) {
	checker := &fakeTokenRevocationChecker{err: errors.New("redis unavailable")}
	handler := NewTokenRevocationMiddleware(checker, "secret").Handle(func(http.ResponseWriter, *http.Request) {})
	req := httptest.NewRequest(http.MethodPost, "/api/account/detail", nil)
	req.Header.Set("Authorization", "Bearer "+signedTokenForMiddleware(t, "secret", "session-2"))
	recorder := httptest.NewRecorder()

	handler(recorder, req)

	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", recorder.Code)
	}
}

func TestTokenRevocationMiddlewarePassesRequestsWithoutUsableJWT(t *testing.T) {
	checker := &fakeTokenRevocationChecker{}
	for _, authorization := range []string{"", "Bearer malformed"} {
		nextCalled := false
		handler := NewTokenRevocationMiddleware(checker, "secret").Handle(func(http.ResponseWriter, *http.Request) {
			nextCalled = true
		})
		req := httptest.NewRequest(http.MethodGet, "/api/homepage/config", nil)
		req.Header.Set("Authorization", authorization)
		handler(httptest.NewRecorder(), req)
		if !nextCalled {
			t.Fatalf("request with Authorization %q did not pass through", authorization)
		}
	}
}
