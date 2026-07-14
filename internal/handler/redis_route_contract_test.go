package handler

import (
	"os"
	"strings"
	"testing"
)

func TestRedisRateLimitMiddlewaresAreAttachedToPublicRoutes(t *testing.T) {
	source, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		"serverCtx.LoginRateLimit(account.LoginAccountHandler(serverCtx))",
		"serverCtx.RegisterRateLimit(account.RegisterAccountHandler(serverCtx))",
		"serverCtx.SearchRateLimit(search.GlobalSearchHandler(serverCtx))",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("routes.go missing %q", fragment)
		}
	}
}

func TestLogoutRouteIsProtectedByJWT(t *testing.T) {
	source, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	text := string(source)
	if !strings.Contains(text, `Path:    "/account/logout"`) || !strings.Contains(text, "account.LogoutAccountHandler(serverCtx)") {
		t.Fatal("JWT account route group is missing logout")
	}
}
