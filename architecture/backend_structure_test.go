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

func TestModelsAreOrganizedByBusinessModule(t *testing.T) {
	root := repositoryRoot(t)
	modules := []string{
		"account",
		"admin",
		"follow",
		"forum",
		"homepage",
		"interaction",
		"media",
		"moderation",
		"notification",
		"post",
		"profile",
		"search",
		"statistics",
		"taxonomy",
	}
	for _, module := range modules {
		path := filepath.Join(root, "model", module)
		info, err := os.Stat(path)
		if err != nil {
			t.Errorf("model module %s: %v", module, err)
			continue
		}
		if !info.IsDir() {
			t.Errorf("model module %s is not a directory", module)
		}
	}

	rootFiles, err := filepath.Glob(filepath.Join(root, "model", "*.go"))
	if err != nil {
		t.Fatalf("list root model files: %v", err)
	}
	if len(rootFiles) != 0 {
		t.Errorf("root model package still contains Go files: %v", rootFiles)
	}
}
