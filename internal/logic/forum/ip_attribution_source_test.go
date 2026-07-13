package forum

import (
	"os"
	"strings"
	"testing"
)

func TestCreateForumPostRecordsPostIPAttribution(t *testing.T) {
	source, err := os.ReadFile("createforumpostlogic.go")
	if err != nil {
		t.Fatalf("read createforumpostlogic.go: %v", err)
	}
	for _, want := range []string{
		"ipgeo.RecordContentAttribution",
		"ipgeo.TargetTypePost",
		"ipgeo.ActionTypeCreate",
	} {
		if !strings.Contains(string(source), want) {
			t.Fatalf("forum post creation missing %q", want)
		}
	}
}

func TestCreateForumPostDoesNotAcceptUserProvidedLocation(t *testing.T) {
	source, err := os.ReadFile("createforumpostlogic.go")
	if err != nil {
		t.Fatalf("read createforumpostlogic.go: %v", err)
	}
	for _, forbidden := range []string{"req.Location", "Location:"} {
		if strings.Contains(string(source), forbidden) {
			t.Fatalf("forum post creation still accepts user location through %q", forbidden)
		}
	}
}
