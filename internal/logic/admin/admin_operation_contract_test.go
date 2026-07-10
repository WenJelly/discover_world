package admin

import (
	"os"
	"strings"
	"testing"
)

func readAdminLogicSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func TestAdminOperationContracts(t *testing.T) {
	for _, item := range []struct {
		path       string
		capability string
		mustAudit  bool
	}{
		{path: "getadminoperationdashboardlogic.go", capability: "adminsupport.CapabilityOperationManage"},
		{path: "getadmintaglistlogic.go", capability: "adminsupport.CapabilityOperationManage"},
		{path: "updateadmintaglogic.go", capability: "adminsupport.CapabilityOperationManage", mustAudit: true},
		{path: "mergeadmintaglogic.go", capability: "adminsupport.CapabilityOperationManage", mustAudit: true},
		{path: "featureadmincontentlogic.go", capability: "adminsupport.CapabilityOperationManage", mustAudit: true},
		{path: "unfeatureadmincontentlogic.go", capability: "adminsupport.CapabilityOperationManage", mustAudit: true},
	} {
		source := readAdminLogicSource(t, item.path)
		if !strings.Contains(source, "adminsupport.RequireAdminCapability") || !strings.Contains(source, item.capability) {
			t.Fatalf("%s missing operation capability check", item.path)
		}
		if item.mustAudit && (!strings.Contains(source, "adminsupport.RecordOperation") || !strings.Contains(source, "adminsupport.OperationLogInput")) {
			t.Fatalf("%s missing admin audit write", item.path)
		}
	}
}
