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

func TestPostWritesDoNotAcceptUserProvidedLocation(t *testing.T) {
	createSource, err := os.ReadFile("createpostlogic.go")
	if err != nil {
		t.Fatalf("read createpostlogic.go: %v", err)
	}
	updateSource, err := os.ReadFile("updatepostlogic.go")
	if err != nil {
		t.Fatalf("read updatepostlogic.go: %v", err)
	}

	for name, source := range map[string]string{
		"create": string(createSource),
		"update": string(updateSource),
	} {
		for _, forbidden := range []string{"req.Location", "normalizePostLocation"} {
			if strings.Contains(source, forbidden) {
				t.Fatalf("%s post logic still accepts user location through %q", name, forbidden)
			}
		}
	}
	if strings.Contains(string(createSource), "Location:") {
		t.Fatal("create post logic still writes a user-provided location")
	}
	if strings.Contains(string(updateSource), "existing.Location =") {
		t.Fatal("update post logic still changes the stored location")
	}
}
