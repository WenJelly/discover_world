package clientip

import (
	"context"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

type contextKey struct{}

func WithClientIP(ctx context.Context, addr netip.Addr) context.Context {
	if ctx == nil || !addr.IsValid() {
		return ctx
	}
	return context.WithValue(ctx, contextKey{}, addr)
}

func FromContext(ctx context.Context) (netip.Addr, bool) {
	if ctx == nil {
		return netip.Addr{}, false
	}
	addr, ok := ctx.Value(contextKey{}).(netip.Addr)
	return addr, ok && addr.IsValid()
}

func Middleware(trustedProxies []string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			if addr, ok := FromRequest(r, trustedProxies); ok {
				r = r.WithContext(WithClientIP(r.Context(), addr))
			}
			next(w, r)
		}
	}
}

func FromRequest(r *http.Request, trustedProxies []string) (netip.Addr, bool) {
	if r == nil {
		return netip.Addr{}, false
	}

	remote, ok := parseRemoteAddr(r.RemoteAddr)
	if !ok {
		return netip.Addr{}, false
	}

	if isTrustedProxy(remote, trustedProxies) {
		if forwarded, ok := firstForwardedIP(r.Header.Get("X-Forwarded-For")); ok {
			return forwarded, true
		}
		if realIP, ok := parseHeaderIP(r.Header.Get("X-Real-IP")); ok {
			return realIP, true
		}
	}

	return remote, true
}

func parseRemoteAddr(raw string) (netip.Addr, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return netip.Addr{}, false
	}
	host, _, err := net.SplitHostPort(raw)
	if err == nil {
		raw = host
	}
	return parseHeaderIP(raw)
}

func firstForwardedIP(raw string) (netip.Addr, bool) {
	for _, part := range strings.Split(raw, ",") {
		if addr, ok := parseHeaderIP(part); ok {
			return addr, true
		}
	}
	return netip.Addr{}, false
}

func parseHeaderIP(raw string) (netip.Addr, bool) {
	raw = strings.Trim(strings.TrimSpace(raw), "[]")
	if raw == "" {
		return netip.Addr{}, false
	}
	addr, err := netip.ParseAddr(raw)
	if err != nil || !addr.IsValid() {
		return netip.Addr{}, false
	}
	return addr.Unmap(), true
}

func isTrustedProxy(addr netip.Addr, trustedProxies []string) bool {
	if !addr.IsValid() || len(trustedProxies) == 0 {
		return false
	}
	for _, raw := range trustedProxies {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if prefix, err := netip.ParsePrefix(raw); err == nil {
			if prefix.Contains(addr) {
				return true
			}
			continue
		}
		if trustedAddr, err := netip.ParseAddr(raw); err == nil && trustedAddr.Unmap() == addr {
			return true
		}
	}
	return false
}
