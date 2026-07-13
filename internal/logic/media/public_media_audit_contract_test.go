package media

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func readMediaAuditContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func mediaAuditContractTypeBody(t *testing.T, source, typeName string) string {
	t.Helper()
	pattern := regexp.MustCompile(`(?s)(?:type\s+)?\b` + regexp.QuoteMeta(typeName) + `\b\s+(?:struct\s*)?\{(.*?)\}`)
	match := pattern.FindStringSubmatch(source)
	if len(match) != 2 {
		t.Fatalf("type %s not found", typeName)
	}
	return match[1]
}

func TestPublicMediaListContractsDoNotExposeAuditStatus(t *testing.T) {
	for _, item := range []struct {
		name   string
		source string
	}{
		{name: "api", source: readMediaAuditContractSource(t, "../../../api/discover_world.api")},
		{name: "generated types", source: readMediaAuditContractSource(t, "../../types/types.go")},
	} {
		t.Run(item.name, func(t *testing.T) {
			for _, typeName := range []string{"QueryMediaAssetRequest", "CursorQueryMediaAssetRequest"} {
				body := mediaAuditContractTypeBody(t, item.source, typeName)
				if strings.Contains(body, "AuditStatus") || strings.Contains(body, "auditStatus") {
					t.Fatalf("public type %s must not expose auditStatus: %s", typeName, body)
				}
			}

			adminBody := mediaAuditContractTypeBody(t, item.source, "AdminQueryMediaAssetRequest")
			if !strings.Contains(adminBody, "AuditStatus") || !strings.Contains(adminBody, "auditStatus") {
				t.Fatalf("admin media query must retain auditStatus: %s", adminBody)
			}
		})
	}
}
