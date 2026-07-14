package media

import (
	"os"
	"strings"
	"testing"
)

func TestListConsumersUseBatchAvatarResolution(t *testing.T) {
	for _, path := range []string{
		"../search/globalsearchlogic.go",
		"../follow/common.go",
		"../notification/common.go",
	} {
		source, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		text := string(source)
		if strings.Contains(text, "mediaLogic.LoadAvatarURL(") {
			t.Fatalf("%s still resolves avatars one-by-one", path)
		}
		if !strings.Contains(text, "mediaLogic.LoadAvatarURLsByOwner(") {
			t.Fatalf("%s does not use batch avatar resolution", path)
		}
	}
}
