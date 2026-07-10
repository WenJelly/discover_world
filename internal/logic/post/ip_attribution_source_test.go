package post

import (
	"os"
	"strings"
	"testing"
)

func TestCreatePostRecordsIPAttributionAndReturnsRegion(t *testing.T) {
	createSource, err := os.ReadFile("createpostlogic.go")
	if err != nil {
		t.Fatalf("read createpostlogic.go: %v", err)
	}
	commonSource, err := os.ReadFile("common.go")
	if err != nil {
		t.Fatalf("read common.go: %v", err)
	}

	for _, want := range []string{
		"ipgeo.RecordContentAttribution",
		"ipgeo.TargetTypePost",
		"ipgeo.ActionTypeCreate",
	} {
		if !strings.Contains(string(createSource), want) {
			t.Fatalf("create post logic missing %q", want)
		}
	}
	for _, want := range []string{
		"loadIPRegionsByTarget",
		"IpRegion:",
	} {
		if !strings.Contains(string(commonSource), want) {
			t.Fatalf("post response builder missing %q", want)
		}
	}
}
