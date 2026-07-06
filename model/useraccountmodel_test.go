package model

import (
	"os"
	"strings"
	"testing"
)

func TestUserAccountModelFindOneByEmailCaseSensitiveUsesBinaryComparison(t *testing.T) {
	source, err := os.ReadFile("useraccountmodel.go")
	if err != nil {
		t.Fatalf("read useraccountmodel.go: %v", err)
	}
	text := string(source)

	for _, fragment := range []string{
		"FindOneByEmailCaseSensitive",
		"where binary `email` = ? limit 1",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("useraccountmodel.go missing %q for case-sensitive email lookup", fragment)
		}
	}
}
