package handler

import (
	"os"
	"strings"
	"testing"
)

func TestUploadRoutesOnlyExposeDirectObjectStorageAndAvatarBinding(t *testing.T) {
	routes, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	api, err := os.ReadFile("../../api/discover_world.api")
	if err != nil {
		t.Fatalf("read discover_world.api: %v", err)
	}

	for name, source := range map[string]string{
		"routes.go":          string(routes),
		"discover_world.api": string(api),
	} {
		for _, required := range []string{
			"/media/upload/direct/init",
			"/media/upload/direct/complete",
			"/account/avatar/set",
		} {
			if !strings.Contains(source, required) {
				t.Fatalf("%s missing %q", name, required)
			}
		}
		for _, forbidden := range []string{
			"/media/upload\"",
			"/media/upload/url",
			"/account/avatar/upload",
		} {
			if strings.Contains(source, forbidden) {
				t.Fatalf("%s still exposes server-mediated upload route %q", name, forbidden)
			}
		}
	}
}

func TestServerMediatedUploadHandlersAndLogicAreRemoved(t *testing.T) {
	for _, path := range []string{
		"account/uploadaccountavatarhandler.go",
		"media/uploadmediaassethandler.go",
		"media/uploadmediaassetbyurlhandler.go",
		"../logic/media/uploadmediaassetlogic.go",
		"../logic/media/uploadmediaassetbyurllogic.go",
	} {
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Fatalf("server-mediated upload file still exists: %s", path)
		}
	}
}
