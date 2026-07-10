package handler

import (
	"strings"
	"testing"
)

func TestAdminBackendEnhancementRoutesAreRegisteredWithAdminCheck(t *testing.T) {
	routes := readHandlerContractSource(t, "routes.go")

	for _, item := range []struct {
		path    string
		handler string
	}{
		{path: "/moderation/report/list", handler: "moderation.GetAdminModerationReportListHandler(serverCtx)"},
		{path: "/moderation/report/detail", handler: "moderation.GetAdminModerationReportDetailHandler(serverCtx)"},
		{path: "/moderation/report/resolve", handler: "moderation.ResolveAdminModerationReportHandler(serverCtx)"},
		{path: "/moderation/content/list", handler: "moderation.GetAdminContentListHandler(serverCtx)"},
		{path: "/moderation/comment/hide", handler: "moderation.AdminHideCommentHandler(serverCtx)"},
		{path: "/moderation/comment/restore", handler: "moderation.AdminRestoreCommentHandler(serverCtx)"},
		{path: "/operation/dashboard", handler: "admin.GetAdminOperationDashboardHandler(serverCtx)"},
		{path: "/operation/tag/list", handler: "admin.GetAdminTagListHandler(serverCtx)"},
		{path: "/operation/tag/update", handler: "admin.UpdateAdminTagHandler(serverCtx)"},
		{path: "/operation/tag/merge", handler: "admin.MergeAdminTagHandler(serverCtx)"},
		{path: "/operation/content/feature", handler: "admin.FeatureAdminContentHandler(serverCtx)"},
		{path: "/operation/content/unfeature", handler: "admin.UnfeatureAdminContentHandler(serverCtx)"},
		{path: "/audit/operation/list", handler: "admin.GetAdminOperationLogListHandler(serverCtx)"},
		{path: "/audit/operation/detail", handler: "admin.GetAdminOperationLogDetailHandler(serverCtx)"},
	} {
		group := routeGroupContaining(t, routes, item.path)
		if !containsAll(group, item.handler, "serverCtx.AdminCheck", "rest.WithJwt") {
			t.Fatalf("route %s missing handler/AdminCheck/JWT contract", item.path)
		}
	}
}

func containsAll(source string, fragments ...string) bool {
	for _, fragment := range fragments {
		if !strings.Contains(source, fragment) {
			return false
		}
	}
	return true
}
