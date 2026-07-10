package admin

import (
	"strings"
	"testing"
)

func TestAdminAuditContracts(t *testing.T) {
	for _, path := range []string{
		"getadminoperationloglistlogic.go",
		"getadminoperationlogdetaillogic.go",
	} {
		source := readAdminLogicSource(t, path)
		for _, fragment := range []string{
			"adminsupport.RequireAdminCapability",
			"adminsupport.CapabilityAuditRead",
			"AdminOperationLogModel",
		} {
			if !strings.Contains(source, fragment) {
				t.Fatalf("%s missing %q", path, fragment)
			}
		}
	}
}
