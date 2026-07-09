package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func readHandlerContractSource(t *testing.T, path string) string {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	return string(source)
}

func routeGroupContaining(t *testing.T, routes string, path string) string {
	t.Helper()
	routeIndex := strings.Index(routes, `Path:    "`+path+`"`)
	if routeIndex < 0 {
		t.Fatalf("routes.go missing path %s", path)
	}
	groupStart := strings.LastIndex(routes[:routeIndex], "server.AddRoutes(")
	if groupStart < 0 {
		t.Fatalf("route %s is not inside server.AddRoutes", path)
	}
	groupEnd := len(routes)
	if nextGroup := strings.Index(routes[routeIndex:], "\n\tserver.AddRoutes("); nextGroup >= 0 {
		groupEnd = routeIndex + nextGroup
	}
	return routes[groupStart:groupEnd]
}

func TestCommunityPublicRoutesAreRegisteredWithoutJwt(t *testing.T) {
	routes := readHandlerContractSource(t, "routes.go")

	for _, item := range []struct {
		path    string
		handler string
	}{
		{path: "/post/public/list/cursor", handler: "post.GetPublicPostCursorListHandler(serverCtx)"},
		{path: "/forum/board/list", handler: "forum.GetForumBoardListHandler(serverCtx)"},
		{path: "/forum/post/list/cursor", handler: "forum.GetForumPostCursorListHandler(serverCtx)"},
	} {
		group := routeGroupContaining(t, routes, item.path)
		if !strings.Contains(group, item.handler) {
			t.Fatalf("route %s missing handler %s", item.path, item.handler)
		}
		if strings.Contains(group, "rest.WithJwt") {
			t.Fatalf("route %s should be public and must not be in a JWT group", item.path)
		}
	}
}

func TestCommunityAuthenticatedRoutesAreRegisteredWithJwt(t *testing.T) {
	routes := readHandlerContractSource(t, "routes.go")

	for _, item := range []struct {
		path    string
		handler string
	}{
		{path: "/forum/post/create", handler: "forum.CreateForumPostHandler(serverCtx)"},
		{path: "/moderation/report/create", handler: "moderation.CreateModerationReportHandler(serverCtx)"},
	} {
		group := routeGroupContaining(t, routes, item.path)
		if !strings.Contains(group, item.handler) {
			t.Fatalf("route %s missing handler %s", item.path, item.handler)
		}
		if !strings.Contains(group, "rest.WithJwt") {
			t.Fatalf("route %s must be in a JWT group", item.path)
		}
	}
}

func TestCommunityAdminModerationRoutesAreRegisteredWithAdminCheck(t *testing.T) {
	routes := readHandlerContractSource(t, "routes.go")

	for _, item := range []struct {
		path    string
		handler string
	}{
		{path: "/moderation/post/hide", handler: "moderation.AdminHidePostHandler(serverCtx)"},
		{path: "/moderation/post/restore", handler: "moderation.AdminRestorePostHandler(serverCtx)"},
		{path: "/forum/post/lock", handler: "moderation.AdminLockForumPostHandler(serverCtx)"},
		{path: "/forum/post/unlock", handler: "moderation.AdminUnlockForumPostHandler(serverCtx)"},
		{path: "/forum/post/pin", handler: "moderation.AdminPinForumPostHandler(serverCtx)"},
		{path: "/forum/post/unpin", handler: "moderation.AdminUnpinForumPostHandler(serverCtx)"},
	} {
		group := routeGroupContaining(t, routes, item.path)
		if !strings.Contains(group, item.handler) {
			t.Fatalf("route %s missing handler %s", item.path, item.handler)
		}
		if !strings.Contains(group, "serverCtx.AdminCheck") {
			t.Fatalf("route %s must use AdminCheck middleware", item.path)
		}
		if !strings.Contains(group, "rest.WithJwt") {
			t.Fatalf("route %s must be in a JWT group", item.path)
		}
	}
}

func TestCommunityHandlerFilesCallExpectedLogic(t *testing.T) {
	for _, item := range []struct {
		path      string
		request   string
		logicCtor string
	}{
		{path: filepath.Join("post", "getpublicpostcursorlisthandler.go"), request: "types.PublicPostListRequest", logicCtor: "logic.NewGetPublicPostCursorListLogic"},
		{path: filepath.Join("forum", "getforumboardlisthandler.go"), request: "types.ForumBoardListRequest", logicCtor: "logic.NewGetForumBoardListLogic"},
		{path: filepath.Join("forum", "getforumpostcursorlisthandler.go"), request: "types.ForumPostListRequest", logicCtor: "logic.NewGetForumPostCursorListLogic"},
		{path: filepath.Join("forum", "createforumposthandler.go"), request: "types.CreateForumPostRequest", logicCtor: "logic.NewCreateForumPostLogic"},
		{path: filepath.Join("moderation", "createmoderationreporthandler.go"), request: "types.CreateModerationReportRequest", logicCtor: "logic.NewCreateModerationReportLogic"},
	} {
		source := readHandlerContractSource(t, item.path)
		if !strings.Contains(source, item.request) {
			t.Fatalf("%s missing request type %s", item.path, item.request)
		}
		if !strings.Contains(source, item.logicCtor) {
			t.Fatalf("%s missing logic constructor %s", item.path, item.logicCtor)
		}
	}
}
