package model

import (
	"strings"
	"testing"
)

func TestPostRowsIncludesPinFields(t *testing.T) {
	for _, field := range []string{"`is_pinned`", "`pinned_at`"} {
		if !strings.Contains(postRows, field) {
			t.Fatalf("postRows does not include %s: %s", field, postRows)
		}
	}
}
