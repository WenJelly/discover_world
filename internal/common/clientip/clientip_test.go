package clientip

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestFromRequestUsesRemoteAddrWhenProxyIsNotTrusted(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/post/create", nil)
	req.RemoteAddr = "203.0.113.10:4567"
	req.Header.Set("X-Forwarded-For", "8.8.8.8")

	got, ok := FromRequest(req, []string{"10.0.0.0/8"})
	if !ok {
		t.Fatal("expected client IP from remote address")
	}
	if got != netip.MustParseAddr("203.0.113.10") {
		t.Fatalf("got %s, want remote address", got)
	}
}

func TestFromRequestTrustsForwardedForFromTrustedProxy(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/post/create", nil)
	req.RemoteAddr = "10.2.3.4:4567"
	req.Header.Set("X-Forwarded-For", "8.8.8.8, 10.2.3.4")

	got, ok := FromRequest(req, []string{"10.0.0.0/8"})
	if !ok {
		t.Fatal("expected client IP from X-Forwarded-For")
	}
	if got != netip.MustParseAddr("8.8.8.8") {
		t.Fatalf("got %s, want first forwarded IP", got)
	}
}

func TestMiddlewareStoresClientIPInContext(t *testing.T) {
	req := httptest.NewRequest("POST", "/api/media/upload", nil)
	req.RemoteAddr = "198.51.100.20:8080"

	handler := Middleware(nil)(func(_ http.ResponseWriter, r *http.Request) {
		got, ok := FromContext(r.Context())
		if !ok {
			t.Fatal("expected client IP in context")
		}
		if got != netip.MustParseAddr("198.51.100.20") {
			t.Fatalf("got %s, want context client IP", got)
		}
	})

	handler(httptest.NewRecorder(), req)
}
