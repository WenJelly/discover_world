package adminsupport

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGovernanceLogicDoesNotWriteAuditOutsideTransaction(t *testing.T) {
	logicRoot := ".."
	err := filepath.WalkDir(logicRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		if filepath.Clean(path) == filepath.Clean("common.go") || strings.Contains(path, string(filepath.Separator)+"adminsupport"+string(filepath.Separator)) {
			return nil
		}
		source, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if strings.Contains(string(source), "adminsupport.RecordOperation(") {
			t.Errorf("%s writes audit outside adminsupport.TransactOperation", path)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walk governance logic: %v", err)
	}
}
