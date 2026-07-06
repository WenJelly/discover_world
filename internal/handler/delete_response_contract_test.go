package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDeleteHandlersReturnJSONSuccessResponses(t *testing.T) {
	files := []string{
		filepath.Join("media", "deletemediaassethandler.go"),
		filepath.Join("post", "deleteposthandler.go"),
	}

	for _, file := range files {
		t.Run(file, func(t *testing.T) {
			source, err := os.ReadFile(filepath.Join(file))
			if err != nil {
				t.Fatalf("read handler source: %v", err)
			}
			text := string(source)
			if strings.Contains(text, "httpx.Ok(w)") {
				t.Fatalf("%s uses empty-body httpx.Ok(w); delete success responses must be JSON", file)
			}
			if !strings.Contains(text, "httpx.OkJsonCtx(r.Context(), w,") {
				t.Fatalf("%s must return a JSON success body", file)
			}
		})
	}
}
