package model

import (
	"os"
	"strings"
	"testing"
)

func assertModelSourceContains(t *testing.T, path string, fragments ...string) {
	t.Helper()
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	text := string(source)
	for _, fragment := range fragments {
		if !strings.Contains(text, fragment) {
			t.Fatalf("%s missing %q", path, fragment)
		}
	}
}

func TestAdminBackendModelContracts(t *testing.T) {
	assertModelSourceContains(t, "adminoperationlogmodel.go",
		"AdminOperationLogModel interface",
		"Insert(ctx context.Context, data *AdminOperationLog) (sql.Result, error)",
		"FindByID(ctx context.Context, id uint64) (*AdminOperationLog, error)",
		"FindByFilter(ctx context.Context, filter AdminOperationLogFilter, pageNum int64, pageSize int64) ([]*AdminOperationLog, error)",
		"CountByFilter(ctx context.Context, filter AdminOperationLogFilter) (int64, error)",
		"`admin_operation_log`",
	)
	assertModelSourceContains(t, "adminrolepolicymodel.go",
		"AdminRolePolicyModel interface",
		"HasCapability(ctx context.Context, role string, capability string) (bool, error)",
		"`admin_role_policy`",
	)
	assertModelSourceContains(t, "moderationreportmodel.go",
		"FindByFilter(ctx context.Context, filter ModerationReportFilter, pageNum int64, pageSize int64) ([]*ModerationReport, error)",
		"CountByFilter(ctx context.Context, filter ModerationReportFilter) (int64, error)",
		"Resolve(ctx context.Context, req ResolveModerationReportRequest) error",
		"HandlerUserId",
		"Resolution",
		"ResolutionNote",
		"sql.NullInt64",
		"sql.NullString",
	)
	assertModelSourceContains(t, "commentrecordmodel.go",
		"SetStatus(ctx context.Context, id uint64, status string) error",
		"FindByFilter(ctx context.Context, filter CommentRecordFilter, pageNum int64, pageSize int64) ([]*CommentRecord, error)",
		"CountByFilter(ctx context.Context, filter CommentRecordFilter) (int64, error)",
	)
	assertModelSourceContains(t, "postmodel.go",
		"FindAdminByFilter(ctx context.Context, filter PostAdminFilter, pageNum int64, pageSize int64) ([]*Post, error)",
		"CountAdminByFilter(ctx context.Context, filter PostAdminFilter) (int64, error)",
	)
	assertModelSourceContains(t, "tagmodel.go",
		"FindByFilter(ctx context.Context, filter TagFilter, pageNum int64, pageSize int64) ([]*Tag, error)",
		"CountByFilter(ctx context.Context, filter TagFilter) (int64, error)",
	)
	assertModelSourceContains(t, "taggingmodel.go",
		"MoveTaggings(ctx context.Context, sourceTagID uint64, targetTagID uint64) error",
	)
}

func TestAdminBackendModelsRegisteredInServiceContext(t *testing.T) {
	source, err := os.ReadFile("../internal/svc/servicecontext.go")
	if err != nil {
		t.Fatalf("read servicecontext.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		"AdminOperationLogModel",
		"AdminRolePolicyModel",
		"model.NewAdminOperationLogModel(conn)",
		"model.NewAdminRolePolicyModel(conn)",
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("servicecontext.go missing %q", fragment)
		}
	}
}
