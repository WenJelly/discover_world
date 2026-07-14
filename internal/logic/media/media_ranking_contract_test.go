package media

import (
	"os"
	"strings"
	"testing"
)

func TestMediaRankingRefreshesAfterScoreAndVisibilityChanges(t *testing.T) {
	paths := []string{
		"getmediaassetlogic.go",
		"downloadmediaassetlogic.go",
		"togglemediareactionlogic.go",
		"reviewmediaassetlogic.go",
		"deletemediaassetlogic.go",
		"direct_upload.go",
	}

	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		if !strings.Contains(string(data), "refreshMediaRanking") {
			t.Fatalf("%s must refresh the precomputed media ranking", path)
		}
	}
}
