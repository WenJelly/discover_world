package architecture_test

import (
	"os"
	"path/filepath"
	"testing"
)

func repositoryRoot(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("..")
	if err != nil {
		t.Fatalf("resolve repository root: %v", err)
	}
	return root
}

func TestGeneratedModelsAreNotInAChildPackage(t *testing.T) {
	path := filepath.Join(repositoryRoot(t), "model", "gen")
	_, err := os.Stat(path)
	if err == nil {
		t.Fatalf("generated model subpackage must not exist: %s", path)
	}
	if !os.IsNotExist(err) {
		t.Fatalf("inspect generated model subpackage: %v", err)
	}
}
