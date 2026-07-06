package search

import (
	"reflect"
	"strings"
	"testing"

	"discover_world/internal/types"
)

func TestNormalizeSearchRequestDefaultsToAllPublicTypes(t *testing.T) {
	req := &types.GlobalSearchRequest{
		Q:        "  mountain  ",
		PageSize: 0,
	}

	normalized, err := normalizeSearchRequest(req)
	if err != nil {
		t.Fatalf("normalizeSearchRequest returned error: %v", err)
	}

	if normalized.Query != "mountain" {
		t.Fatalf("Query = %q, want mountain", normalized.Query)
	}
	if normalized.PageSize != 20 {
		t.Fatalf("PageSize = %d, want 20", normalized.PageSize)
	}
	wantTypes := []string{"media", "post", "album", "user"}
	if !reflect.DeepEqual(normalized.Types, wantTypes) {
		t.Fatalf("Types = %#v, want %#v", normalized.Types, wantTypes)
	}
}

func TestNormalizeSearchRequestDedupesAndRejectsUnknownTypes(t *testing.T) {
	req := &types.GlobalSearchRequest{
		Q:        "forest",
		Types:    []string{"media", " user ", "media", "unknown"},
		PageSize: 10,
	}

	_, err := normalizeSearchRequest(req)
	if err == nil {
		t.Fatal("normalizeSearchRequest returned nil error for unknown type")
	}
	if !strings.Contains(err.Error(), "search types") {
		t.Fatalf("error = %v, want search types validation message", err)
	}

	req.Types = []string{"media", " user ", "media"}
	normalized, err := normalizeSearchRequest(req)
	if err != nil {
		t.Fatalf("normalizeSearchRequest returned error: %v", err)
	}
	wantTypes := []string{"media", "user"}
	if !reflect.DeepEqual(normalized.Types, wantTypes) {
		t.Fatalf("Types = %#v, want %#v", normalized.Types, wantTypes)
	}
}

