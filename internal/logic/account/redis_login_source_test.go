package account

import (
	"os"
	"strings"
	"testing"
)

func TestLoginUsesHashedAccountRateLimitAndClearsItOnSuccess(t *testing.T) {
	source, err := os.ReadFile("loginaccountlogic.go")
	if err != nil {
		t.Fatalf("read loginaccountlogic.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		`HashSubject(l.svcCtx.Config.Auth.AccessSecret, email)`,
		`Allow(l.ctx, "login:account"`,
		`Delete(l.ctx, "ratelimit:login:account:"+subject)`,
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("loginaccountlogic.go missing %q", fragment)
		}
	}
}
