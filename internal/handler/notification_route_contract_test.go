package handler

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNotificationAndFeedRoutes(t *testing.T) {
	routesSource, err := os.ReadFile("routes.go")
	if err != nil {
		t.Fatalf("read routes.go: %v", err)
	}
	routes := string(routesSource)

	for _, item := range []struct {
		path    string
		handler string
	}{
		{path: "/notification/list/cursor", handler: "notification.GetNotificationCursorListHandler(serverCtx)"},
		{path: "/notification/unread/count", handler: "notification.GetUnreadNotificationCountHandler(serverCtx)"},
		{path: "/notification/read", handler: "notification.MarkNotificationReadHandler(serverCtx)"},
		{path: "/notification/read/all", handler: "notification.MarkAllNotificationsReadHandler(serverCtx)"},
		{path: "/feed/following/post/list/cursor", handler: "feed.GetFollowingPostCursorListHandler(serverCtx)"},
		{path: "/feed/following/media/list/cursor", handler: "feed.GetFollowingMediaCursorListHandler(serverCtx)"},
	} {
		group := routeGroupContaining(t, routes, item.path)
		if !strings.Contains(group, item.handler) {
			t.Fatalf("route %s missing handler %s", item.path, item.handler)
		}
		if !strings.Contains(group, "rest.WithJwt") {
			t.Fatalf("route %s must be authenticated", item.path)
		}
	}
}

func TestNotificationAndFeedHandlersCallExpectedLogic(t *testing.T) {
	for _, item := range []struct {
		path      string
		request   string
		logicCtor string
	}{
		{path: filepath.Join("notification", "getnotificationcursorlisthandler.go"), request: "types.NotificationListRequest", logicCtor: "logic.NewGetNotificationCursorListLogic"},
		{path: filepath.Join("notification", "getunreadnotificationcounthandler.go"), request: "types.UnreadNotificationCountRequest", logicCtor: "logic.NewGetUnreadNotificationCountLogic"},
		{path: filepath.Join("notification", "marknotificationreadhandler.go"), request: "types.MarkNotificationReadRequest", logicCtor: "logic.NewMarkNotificationReadLogic"},
		{path: filepath.Join("notification", "markallnotificationsreadhandler.go"), request: "types.MarkAllNotificationsReadRequest", logicCtor: "logic.NewMarkAllNotificationsReadLogic"},
		{path: filepath.Join("feed", "getfollowingpostcursorlisthandler.go"), request: "types.FollowingPostListRequest", logicCtor: "logic.NewGetFollowingPostCursorListLogic"},
		{path: filepath.Join("feed", "getfollowingmediacursorlisthandler.go"), request: "types.FollowingMediaListRequest", logicCtor: "logic.NewGetFollowingMediaCursorListLogic"},
	} {
		source, err := os.ReadFile(item.path)
		if err != nil {
			t.Fatalf("read %s: %v", item.path, err)
		}
		text := string(source)
		if !strings.Contains(text, item.request) {
			t.Fatalf("%s missing request type %s", item.path, item.request)
		}
		if !strings.Contains(text, item.logicCtor) {
			t.Fatalf("%s missing logic constructor %s", item.path, item.logicCtor)
		}
	}
}
