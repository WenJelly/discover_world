package picture

import (
	"strings"
	"testing"

	"photo-album/internal/types"
)

func TestBuildPictureThumbnailURLCompressionLevels(t *testing.T) {
	baseURL := "https://example.com/public/photo.webp"

	tests := []struct {
		name     string
		size     int64
		option   types.CompressPictureType
		contains []string
		excludes []string
	}{
		{
			name:   "level 0 keeps original URL",
			size:   12 << 20,
			option: types.CompressPictureType{CompressType: 0},
			contains: []string{
				baseURL,
			},
			excludes: []string{"imageMogr2"},
		},
		{
			name:   "level 1 keeps current adaptive proportional compression",
			size:   6 << 20,
			option: types.CompressPictureType{CompressType: 1},
			contains: []string{
				"imageMogr2/thumbnail/1920x1920>",
				"format/webp/quality/80!",
			},
			excludes: []string{"gravity/center/crop"},
		},
		{
			name:   "level 2 applies stronger proportional compression",
			size:   1 << 20,
			option: types.CompressPictureType{CompressType: 2},
			contains: []string{
				"imageMogr2/thumbnail/1200x1200>",
				"format/webp/quality/70!",
			},
			excludes: []string{"gravity/center/crop"},
		},
		{
			name: "level 3 keeps centered crop behavior",
			size: 1 << 20,
			option: types.CompressPictureType{
				CompressType: 3,
				CutWidth:     420,
				CutHeight:    260,
			},
			contains: []string{
				"imageMogr2/thumbnail/420x260^>",
				"gravity/center/crop/420x260",
				"format/webp",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := buildPictureThumbnailURL(baseURL, tt.size, tt.option)
			if err != nil {
				t.Fatalf("buildPictureThumbnailURL returned error: %v", err)
			}

			for _, want := range tt.contains {
				if !strings.Contains(got, want) {
					t.Fatalf("expected URL %q to contain %q", got, want)
				}
			}

			for _, excluded := range tt.excludes {
				if strings.Contains(got, excluded) {
					t.Fatalf("expected URL %q to exclude %q", got, excluded)
				}
			}
		})
	}
}

func TestBuildPictureThumbnailURLRejectsInvalidCompressionLevels(t *testing.T) {
	baseURL := "https://example.com/public/photo.webp"

	if _, err := buildPictureThumbnailURL(baseURL, 1<<20, types.CompressPictureType{CompressType: 3}); err == nil || !strings.Contains(err.Error(), "compressType=3") {
		t.Fatalf("expected level 3 without crop dimensions to fail with compressType=3 message, got %v", err)
	}

	if _, err := buildPictureThumbnailURL(baseURL, 1<<20, types.CompressPictureType{CompressType: 4}); err == nil || !strings.Contains(err.Error(), "0、1、2、3") {
		t.Fatalf("expected unsupported compression level to mention 0、1、2、3, got %v", err)
	}
}
