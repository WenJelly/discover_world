package architecture_test

import (
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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

func TestCommonPackagesDoNotDependOnLogic(t *testing.T) {
	root := repositoryRoot(t)
	for _, name := range []string{"access", "adminsupport", "ipgeo"} {
		path := filepath.Join(root, "internal", "common", name)
		if info, err := os.Stat(path); err != nil || !info.IsDir() {
			t.Errorf("required common package %s is missing", name)
		}
	}

	commonRoot := filepath.Join(root, "internal", "common")
	err := filepath.WalkDir(commonRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || filepath.Ext(path) != ".go" {
			return nil
		}
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range file.Imports {
			importPath, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			if strings.HasPrefix(importPath, "discover_world/internal/logic/") {
				t.Errorf("common package %s imports business logic %s", path, importPath)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("scan common packages: %v", err)
	}
}
