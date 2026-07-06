package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMediaReactionToggleContractIsRegisteredBehindAuth(t *testing.T) {
	apiSource, err := os.ReadFile(filepath.Join("..", "..", "api", "discover_world.api"))
	if err != nil {
		t.Fatalf("read api contract: %v", err)
	}
	api := string(apiSource)
	for _, fragment := range []string{
		"ToggleMediaReactionRequest",
		"MediaAssetToggleResponse",
		"@handler ToggleMediaReaction",
		"post /media/reaction/toggle (ToggleMediaReactionRequest) returns (MediaAssetToggleResponse)",
	} {
		if !strings.Contains(api, fragment) {
			t.Fatalf("api contract missing %q", fragment)
		}
	}

	routesSource, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	routes := string(routesSource)
	if !strings.Contains(routes, `Path:    "/media/reaction/toggle"`) {
		t.Fatalf("routes.go missing authenticated media reaction toggle route")
	}
	if !strings.Contains(routes, "media.ToggleMediaReactionHandler(serverCtx)") {
		t.Fatalf("routes.go missing ToggleMediaReactionHandler registration")
	}

	routeIndex := strings.Index(routes, `Path:    "/media/reaction/toggle"`)
	groupStart := strings.LastIndex(routes[:routeIndex], "server.AddRoutes(")
	if groupStart < 0 {
		t.Fatalf("media reaction route is not inside server.AddRoutes")
	}
	groupEnd := len(routes)
	if nextGroup := strings.Index(routes[routeIndex:], "\n\tserver.AddRoutes("); nextGroup >= 0 {
		groupEnd = routeIndex + nextGroup
	}
	routeGroup := routes[groupStart:groupEnd]
	if !strings.Contains(routeGroup, "rest.WithJwt") {
		t.Fatalf("media reaction toggle must require JWT auth")
	}

	handlerPath := filepath.Join("media", "togglemediareactionhandler.go")
	handlerSource, err := os.ReadFile(handlerPath)
	if err != nil {
		t.Fatalf("read %s: %v", handlerPath, err)
	}
	handler := string(handlerSource)
	if !strings.Contains(handler, "types.ToggleMediaReactionRequest") {
		t.Fatalf("%s must parse types.ToggleMediaReactionRequest", handlerPath)
	}
	if !strings.Contains(handler, "media.NewToggleMediaReactionLogic") {
		t.Fatalf("%s must call media reaction logic", handlerPath)
	}
}
