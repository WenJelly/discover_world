package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMediaDownloadContractIsRegisteredBehindAuth(t *testing.T) {
	apiSource, err := os.ReadFile(filepath.Join("..", "..", "api", "discover_world.api"))
	if err != nil {
		t.Fatalf("read api contract: %v", err)
	}
	api := string(apiSource)
	for _, fragment := range []string{
		"DownloadMediaAssetRequest",
		"MediaAssetDownloadResponse",
		"@handler DownloadMediaAsset",
		"post /media/download (DownloadMediaAssetRequest) returns (MediaAssetDownloadResponse)",
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
	if !strings.Contains(routes, `Path:    "/media/download"`) {
		t.Fatalf("routes.go missing authenticated media download route")
	}
	if !strings.Contains(routes, "media.DownloadMediaAssetHandler(serverCtx)") {
		t.Fatalf("routes.go missing DownloadMediaAssetHandler registration")
	}

	routeIndex := strings.Index(routes, `Path:    "/media/download"`)
	groupStart := strings.LastIndex(routes[:routeIndex], "server.AddRoutes(")
	if groupStart < 0 {
		t.Fatalf("media download route is not inside server.AddRoutes")
	}
	groupEnd := len(routes)
	if nextGroup := strings.Index(routes[routeIndex:], "\n\tserver.AddRoutes("); nextGroup >= 0 {
		groupEnd = routeIndex + nextGroup
	}
	routeGroup := routes[groupStart:groupEnd]
	if !strings.Contains(routeGroup, "rest.WithJwt") {
		t.Fatalf("media download must require JWT auth")
	}

	handlerPath := filepath.Join("media", "downloadmediaassethandler.go")
	handlerSource, err := os.ReadFile(handlerPath)
	if err != nil {
		t.Fatalf("read %s: %v", handlerPath, err)
	}
	handler := string(handlerSource)
	if !strings.Contains(handler, "types.DownloadMediaAssetRequest") {
		t.Fatalf("%s must parse types.DownloadMediaAssetRequest", handlerPath)
	}
	if !strings.Contains(handler, "media.NewDownloadMediaAssetLogic") {
		t.Fatalf("%s must call media download logic", handlerPath)
	}
}
