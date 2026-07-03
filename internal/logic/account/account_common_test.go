package account

import (
	"database/sql"
	"testing"
	"time"

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
}
