package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGlobalSearchRouteIsPublicPostEndpoint(t *testing.T) {
	routesSource, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	routes := string(routesSource)

	if !strings.Contains(routes, `Path:    "/search"`) {
		t.Fatalf("routes.go missing public /api/search route")
	}
	if !strings.Contains(routes, "search.GlobalSearchHandler(serverCtx)") {
		t.Fatalf("routes.go missing search.GlobalSearchHandler registration")
	}
	searchIndex := strings.Index(routes, `Path:    "/search"`)
	groupStart := strings.LastIndex(routes[:searchIndex], "server.AddRoutes(")
	if groupStart < 0 {
		t.Fatalf("routes.go search route is not inside server.AddRoutes")
	}
	groupEnd := len(routes)
	if nextGroup := strings.Index(routes[searchIndex:], "\n\tserver.AddRoutes("); nextGroup >= 0 {
		groupEnd = searchIndex + nextGroup
	}
	searchGroup := routes[groupStart:groupEnd]
	if strings.Contains(searchGroup, "rest.WithJwt") {
		t.Fatalf("keep /api/search in a public route group")
	}

	handlerPath := filepath.Join("search", "globalsearchhandler.go")
	handlerSource, err := os.ReadFile(handlerPath)
	if err != nil {
		t.Fatalf("read %s: %v", handlerPath, err)
	}
	handler := string(handlerSource)
	if !strings.Contains(handler, "types.GlobalSearchRequest") {
		t.Fatalf("%s must parse types.GlobalSearchRequest", handlerPath)
	}
	if !strings.Contains(handler, "logic.NewGlobalSearchLogic") {
		t.Fatalf("%s must call search logic", handlerPath)
	}
}
