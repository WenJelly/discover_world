package account

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"discover_world/internal/types"
	"discover_world/model"
)

func TestBuildDetailAccountResponseUsesProfileAndMediaStats(t *testing.T) {
	createdAt := time.Date(2026, 7, 3, 10, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Hour)

	resp := buildDetailAccountResponse(
		nil,
		&model.UserAccount{
			Id:        10,
			Username:  "alice",
			Email:     sql.NullString{String: "alice@example.com", Valid: true},
			Status:    "active",
			CreatedAt: createdAt,
			UpdatedAt: updatedAt,
		},
		&model.UserProfile{
			Nickname: sql.NullString{String: "Alice W", Valid: true},
			Bio:      sql.NullString{String: "traveler", Valid: true},
		},
		&model.MediaAssetOwnerStats{
			Total:         7,
			ApprovedCount: 5,
			PendingCount:  1,
			RejectedCount: 1,
		},
		4,
	)

	if resp.Id != "10" || resp.Username != "alice" || resp.Email != "alice@example.com" {
		t.Fatalf("unexpected account fields: %#v", resp)
	}
	if resp.Nickname != "Alice W" || resp.Bio != "traveler" {
		t.Fatalf("unexpected profile fields: %#v", resp)
	}
	if resp.MediaAssetCount != 7 || resp.ApprovedMediaAssetCount != 5 || resp.PendingMediaAssetCount != 1 || resp.RejectedMediaAssetCount != 1 {
		t.Fatalf("unexpected stats: %#v", resp)
	}
	if resp.PublicMediaAssetCount != 4 {
		t.Fatalf("unexpected public media count: %#v", resp)
	}
}

func TestBuildDetailAccountResponseReturnsAccountRoleColumn(t *testing.T) {
	resp := buildDetailAccountResponse(
		nil,
		&model.UserAccount{
			Id:       11,
			Username: "admin",
			Role:     "editor",
			Status:   "active",
		},
		nil,
		nil,
		0,
	)

	if resp.Role != "editor" {
		t.Fatalf("resp.Role = %q, want role column value", resp.Role)
	}
}

func TestCanViewAccountDetailAllowsActivePublicAccount(t *testing.T) {
	viewer := &model.UserAccount{Id: 1, Role: "user", Status: "active"}
	target := &model.UserAccount{Id: 2, Role: "user", Status: "active"}

	if !canViewAccountDetail(nil, viewer, target) {
		t.Fatal("expected active target account to be visible to an authenticated viewer")
	}
}

func TestCanViewAccountDetailRejectsInactiveOtherAccount(t *testing.T) {
	viewer := &model.UserAccount{Id: 1, Role: "user", Status: "active"}
	target := &model.UserAccount{Id: 2, Role: "user", Status: "disabled"}

	if canViewAccountDetail(nil, viewer, target) {
		t.Fatal("expected disabled target account to be hidden from non-admin viewers")
	}
}

func TestMaskDetailAccountForViewerHidesPrivateFieldsForOtherAccount(t *testing.T) {
	viewer := &model.UserAccount{Id: 1, Role: "user", Status: "active"}
	target := &model.UserAccount{Id: 2, Role: "user", Status: "active"}
	resp := &types.DetailAccountResponse{
		Email:                   "target@example.com",
		Phone:                   "1234567890",
		MediaAssetCount:         8,
		PublicMediaAssetCount:   3,
		ApprovedMediaAssetCount: 5,
		PendingMediaAssetCount:  2,
		RejectedMediaAssetCount: 1,
	}

	maskDetailAccountForViewer(nil, viewer, target, resp)

	if resp.Email != "" || resp.Phone != "" {
		t.Fatalf("expected private contact fields to be masked, got %#v", resp)
	}
	if resp.MediaAssetCount != 3 || resp.ApprovedMediaAssetCount != 3 || resp.PendingMediaAssetCount != 0 || resp.RejectedMediaAssetCount != 0 {
		t.Fatalf("expected non-public stats to be masked, got %#v", resp)
	}
}

func TestMaskDetailAccountForViewerKeepsOwnPrivateFields(t *testing.T) {
	viewer := &model.UserAccount{Id: 1, Role: "user", Status: "active"}
	resp := &types.DetailAccountResponse{
		Email:                  "viewer@example.com",
		Phone:                  "1234567890",
		MediaAssetCount:        8,
		PendingMediaAssetCount: 2,
	}

	maskDetailAccountForViewer(nil, viewer, viewer, resp)

	if resp.Email != "viewer@example.com" || resp.Phone != "1234567890" || resp.MediaAssetCount != 8 || resp.PendingMediaAssetCount != 2 {
		t.Fatalf("expected own private fields to be preserved, got %#v", resp)
	}
}

func TestApplyAccountPatchAllowsExpandableRole(t *testing.T) {
	account := &model.UserAccount{Id: 12, Username: "bob", Role: "user"}

	if err := applyAccountPatch(context.Background(), nil, account, "", "", "", "moderator", "", true, false); err != nil {
		t.Fatalf("applyAccountPatch returned error: %v", err)
	}

	if account.Role != "moderator" {
		t.Fatalf("account.Role = %q, want moderator", account.Role)
	}
}

func TestNormalizeLoginEmailPreservesCase(t *testing.T) {
	got, err := normalizeLoginEmail("  Alice@Example.COM  ")
	if err != nil {
		t.Fatalf("normalizeLoginEmail returned error: %v", err)
	}

	if got != "Alice@Example.COM" {
		t.Fatalf("normalizeLoginEmail = %q, want case-preserving trimmed email", got)
	}
}

func TestNormalizeEmailLowercasesStoredAccountEmail(t *testing.T) {
	got, err := normalizeEmail("  Alice@Example.COM  ")
	if err != nil {
		t.Fatalf("normalizeEmail returned error: %v", err)
	}

	if got != "alice@example.com" {
		t.Fatalf("normalizeEmail = %q, want lowercase stored email", got)
	}
}
