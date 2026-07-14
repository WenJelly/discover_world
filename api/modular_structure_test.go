package api_test

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestAPIDefinitionsAreSplitByModule(t *testing.T) {
	moduleHandlerCounts := map[string]int{
		"common":       0,
		"account":      6,
		"follow":       5,
		"profile":      4,
		"post":         11,
		"forum":        3,
		"moderation":   13,
		"notification": 4,
		"feed":         2,
		"media":        9,
		"overview":     1,
		"homepage":     1,
		"search":       1,
		"admin":        12,
	}
	moduleRequiredSnippets := map[string][]string{
		"account": {"post /account/login", "post /account/register", "jwt:    Auth", "middleware: LoginRateLimit", "middleware: RegisterRateLimit"},
		"media":   {"post /media/list", "post /media/review", "middleware: AdminCheck"},
		"admin":   {"prefix:     /api/admin", "middleware: AdminCheck"},
		"post":    {`group:  "post"`},
		"search":  {"post /search", "middleware: SearchRateLimit"},
	}

	root := readFile(t, "discover_world.api")
	if strings.Contains(root, "\ntype (") || strings.Contains(root, "\n@server") {
		t.Fatal("discover_world.api should only aggregate module files and service metadata")
	}

	handlerPattern := regexp.MustCompile(`(?m)^\s*@handler\s+([A-Za-z0-9_]+)\s*$`)
	handlers := make(map[string]string)
	totalHandlers := 0
	for module, expectedCount := range moduleHandlerCounts {
		path := fmt.Sprintf("modules/%s.api", module)
		if !strings.Contains(root, fmt.Sprintf("\"%s\"", path)) {
			t.Errorf("discover_world.api does not import %s", path)
		}

		content := readFile(t, path)
		if !strings.Contains(content, `syntax = "v1"`) {
			t.Errorf("%s must declare syntax v1", path)
		}

		matches := handlerPattern.FindAllStringSubmatch(content, -1)
		if len(matches) != expectedCount {
			t.Errorf("%s has %d handlers, want %d", path, len(matches), expectedCount)
		}
		totalHandlers += len(matches)
		for _, match := range matches {
			name := match[1]
			if previous, exists := handlers[name]; exists {
				t.Errorf("handler %s is declared in both %s and %s", name, previous, path)
			}
			handlers[name] = path
		}
		for _, snippet := range moduleRequiredSnippets[module] {
			if !strings.Contains(content, snippet) {
				t.Errorf("%s is missing %q", path, snippet)
			}
		}
	}

	if totalHandlers != 72 {
		t.Fatalf("modular API declares %d handlers, want 72", totalHandlers)
	}
}

func TestEveryAPIModuleValidatesIndependently(t *testing.T) {
	if _, err := exec.LookPath("goctl"); err != nil {
		t.Skip("goctl is not installed")
	}

	modules, err := filepath.Glob("modules/*.api")
	if err != nil {
		t.Fatalf("list api modules: %v", err)
	}
	if len(modules) == 0 {
		t.Fatal("no api modules found")
	}

	for _, module := range modules {
		module := module
		t.Run(filepath.Base(module), func(t *testing.T) {
			if filepath.Base(module) == "common.api" {
				return
			}
			output, err := exec.Command("goctl", "api", "validate", "--api", module).CombinedOutput()
			if err != nil {
				t.Fatalf("goctl validate %s: %v\n%s", module, err, output)
			}
		})
	}
}

func TestGeneratedRoutesAndTypesAreCurrent(t *testing.T) {
	if _, err := exec.LookPath("goctl"); err != nil {
		t.Skip("goctl is not installed")
	}

	targetDir := t.TempDir()
	goMod := []byte("module discover_world\n\ngo 1.26\n")
	if err := os.WriteFile(filepath.Join(targetDir, "go.mod"), goMod, 0o644); err != nil {
		t.Fatalf("write temporary go.mod: %v", err)
	}
	apiPath, err := filepath.Abs("discover_world.api")
	if err != nil {
		t.Fatalf("resolve aggregate API path: %v", err)
	}
	command := exec.Command("goctl", "api", "go", "--api", apiPath, "--dir", targetDir, "--style", "gozero")
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("generate API in temporary directory: %v\n%s", err, output)
	}

	for _, relative := range []string{"internal/handler/routes.go", "internal/types/types.go"} {
		generated, err := os.ReadFile(filepath.Join(targetDir, relative))
		if err != nil {
			t.Fatalf("read generated %s: %v", relative, err)
		}
		current, err := os.ReadFile(filepath.Join("..", relative))
		if err != nil {
			t.Fatalf("read repository %s: %v", relative, err)
		}
		generated = bytes.ReplaceAll(generated, []byte("\r\n"), []byte("\n"))
		current = bytes.ReplaceAll(current, []byte("\r\n"), []byte("\n"))
		if !bytes.Equal(generated, current) {
			t.Errorf("%s is stale; regenerate it with goctl api go", relative)
		}
	}
}

func readFile(t *testing.T, path string) string {
	t.Helper()
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(content)
}
