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

func TestModelPackagesRespectBoundaries(t *testing.T) {
	root := repositoryRoot(t)
	modelRoot := filepath.Join(root, "model")
	err := filepath.WalkDir(modelRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || filepath.Ext(path) != ".go" {
			return nil
		}

		relative, err := filepath.Rel(modelRoot, path)
		if err != nil {
			return err
		}
		sourceModule := strings.Split(filepath.ToSlash(relative), "/")[0]
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range file.Imports {
			importPath, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			if strings.HasPrefix(importPath, "discover_world/internal/") {
				t.Errorf("model package %s imports internal package %s", path, importPath)
				continue
			}
			const modelPrefix = "discover_world/model/"
			if !strings.HasPrefix(importPath, modelPrefix) {
				continue
			}
			targetModule := strings.Split(strings.TrimPrefix(importPath, modelPrefix), "/")[0]
			if targetModule == "internal" || targetModule == sourceModule {
				continue
			}
			if sourceModule == "search" && (targetModule == "media" || targetModule == "post" || targetModule == "profile") {
				continue
			}
			t.Errorf("model module %s imports feature model %s", sourceModule, importPath)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("scan model packages: %v", err)
	}
}

func TestHandlersOnlyImportMatchingLogic(t *testing.T) {
	root := repositoryRoot(t)
	handlerRoot := filepath.Join(root, "internal", "handler")
	err := filepath.WalkDir(handlerRoot, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() || filepath.Ext(path) != ".go" || path == filepath.Join(handlerRoot, "routes.go") {
			return nil
		}
		relative, err := filepath.Rel(handlerRoot, path)
		if err != nil {
			return err
		}
		module := strings.Split(filepath.ToSlash(relative), "/")[0]
		file, err := parser.ParseFile(token.NewFileSet(), path, nil, parser.ImportsOnly)
		if err != nil {
			return err
		}
		for _, spec := range file.Imports {
			importPath, err := strconv.Unquote(spec.Path.Value)
			if err != nil {
				return err
			}
			const logicPrefix = "discover_world/internal/logic/"
			if !strings.HasPrefix(importPath, logicPrefix) {
				continue
			}
			logicModule := strings.Split(strings.TrimPrefix(importPath, logicPrefix), "/")[0]
			if logicModule != module {
				t.Errorf("handler module %s imports logic module %s in %s", module, logicModule, path)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatalf("scan handlers: %v", err)
	}
}
