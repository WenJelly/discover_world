package media

import (
	"os"
	"strings"
	"testing"
)

func TestMediaUploadRecordsIPAttributionAndReturnsRegion(t *testing.T) {
	storeSource, err := os.ReadFile("store.go")
	if err != nil {
		t.Fatalf("read store.go: %v", err)
	}
	directSource, err := os.ReadFile("direct_upload.go")
	if err != nil {
		t.Fatalf("read direct_upload.go: %v", err)
	}
	viewSource, err := os.ReadFile("view.go")
	if err != nil {
		t.Fatalf("read view.go: %v", err)
	}

	for _, want := range []string{
		"ipgeo.RecordContentAttribution",
		"ipgeo.TargetTypeMediaAsset",
		"ipgeo.ActionTypeUpload",
	} {
		if !strings.Contains(string(storeSource), want) {
			t.Fatalf("media store missing %q", want)
		}
	}
	for _, want := range []string{
		"ipgeo.RecordContentAttribution",
		"ipgeo.TargetTypeMediaAsset",
		"ipgeo.ActionTypeDirectUploadComplete",
	} {
		if !strings.Contains(string(directSource), want) {
			t.Fatalf("direct upload complete missing %q", want)
		}
	}
	for _, want := range []string{
		"loadIPRegionsByTarget",
		"IpRegion:",
	} {
		if !strings.Contains(string(viewSource), want) {
			t.Fatalf("media response builder missing %q", want)
		}
	}
}
