package media

import (
	"os"
	"strings"
	"testing"
)

func TestDownloadMediaAssetLogicRecordsDownloadCounters(t *testing.T) {
	source, err := os.ReadFile("downloadmediaassetlogic.go")
	if err != nil {
		t.Fatalf("read downloadmediaassetlogic.go: %v", err)
	}
	logic := string(source)

	for _, fragment := range []string{
		"LoadRequiredLoginUser",
		"FindOneActive",
		"canViewMediaAsset",
		"canViewOriginal",
		"FindOriginalByAssetID",
		"buildPublicObjectURL",
		`EntityStatModel.IncrementCounter(l.ctx, targetTypeMediaAsset, asset.Id, "download_count", 1)`,
		`EntityStatHourlyModel.IncrementCounter(l.ctx, targetTypeMediaAsset, asset.Id, "download_count", 1)`,
		"FindOneByTargetTypeTargetId",
		"buildMediaStats",
	} {
		if !strings.Contains(logic, fragment) {
			t.Fatalf("download media logic missing %q", fragment)
		}
	}
	if count := strings.Count(logic, `"download_count", 1`); count < 2 {
		t.Fatalf("download media logic should increment total and hourly download counters, found %d", count)
	}
}
