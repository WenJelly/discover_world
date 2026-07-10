package adminsupport

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/model"
)

func TestNormalizePageBoundsAdminRequests(t *testing.T) {
	pageNum, pageSize := NormalizePage(0, 0)
	if pageNum != 1 || pageSize != 20 {
		t.Fatalf("NormalizePage(0,0) = (%d,%d), want (1,20)", pageNum, pageSize)
	}

	pageNum, pageSize = NormalizePage(-3, 500)
	if pageNum != 1 || pageSize != 100 {
		t.Fatalf("NormalizePage(-3,500) = (%d,%d), want (1,100)", pageNum, pageSize)
	}
}

func TestNormalizeReasonRejectsOverlongReason(t *testing.T) {
	if got, err := NormalizeReason("  处理完成  "); err != nil || got != "处理完成" {
		t.Fatalf("NormalizeReason trimmed result = %q, %v", got, err)
	}

	long := make([]rune, 501)
	for i := range long {
		long[i] = '审'
	}
	if _, err := NormalizeReason(string(long)); err == nil {
		t.Fatal("NormalizeReason should reject more than 500 runes")
	} else if commonresponse.StatusCodeFromError(err) != http.StatusBadRequest {
		t.Fatalf("NormalizeReason error status = %d, want 400", commonresponse.StatusCodeFromError(err))
	}
}

func TestRequireAdminCapabilityAllowsAdminRole(t *testing.T) {
	ctx := commonauth.WithLoginUser(context.Background(), &model.UserAccount{
		Id:     7,
		Role:   "admin",
		Status: "active",
	})

	user, err := RequireAdminCapability(ctx, &svc.ServiceContext{}, CapabilityAuditRead)
	if err != nil {
		t.Fatalf("RequireAdminCapability returned error: %v", err)
	}
	if user.Id != 7 {
		t.Fatalf("admin id = %d, want 7", user.Id)
	}
}

func TestBuildAuditSnapshotDropsSensitiveKeys(t *testing.T) {
	snapshot, err := BuildAuditSnapshot(map[string]any{
		"id":           "12",
		"password":     "plain",
		"passwordHash": "hash",
		"status":       "disabled",
	})
	if err != nil {
		t.Fatalf("BuildAuditSnapshot returned error: %v", err)
	}
	if !snapshot.Valid {
		t.Fatal("BuildAuditSnapshot should return valid JSON")
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(snapshot.String), &payload); err != nil {
		t.Fatalf("snapshot is not JSON: %v", err)
	}
	if _, ok := payload["password"]; ok {
		t.Fatal("snapshot leaked password")
	}
	if _, ok := payload["passwordHash"]; ok {
		t.Fatal("snapshot leaked passwordHash")
	}
	if payload["status"] != "disabled" {
		t.Fatalf("snapshot status = %v, want disabled", payload["status"])
	}
}
