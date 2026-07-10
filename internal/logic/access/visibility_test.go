package access

import "testing"

func TestCanViewVisibility(t *testing.T) {
	tests := []struct {
		name       string
		visibility string
		level      ViewerAccessLevel
		want       bool
	}{
		{name: "public sees public", visibility: VisibilityPublic, level: ViewerAccessPublic, want: true},
		{name: "public cannot see followers", visibility: VisibilityFollowers, level: ViewerAccessPublic, want: false},
		{name: "follower sees followers", visibility: VisibilityFollowers, level: ViewerAccessFollower, want: true},
		{name: "follower cannot see private", visibility: VisibilityPrivate, level: ViewerAccessFollower, want: false},
		{name: "owner sees private", visibility: VisibilityPrivate, level: ViewerAccessOwner, want: true},
		{name: "admin sees unlisted", visibility: VisibilityUnlisted, level: ViewerAccessAdmin, want: true},
		{name: "unknown is restricted", visibility: "weird", level: ViewerAccessFollower, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CanViewVisibility(tt.visibility, tt.level); got != tt.want {
				t.Fatalf("CanViewVisibility(%q, %q) = %v, want %v", tt.visibility, tt.level, got, tt.want)
			}
		})
	}
}

func TestVisibleValuesForLevel(t *testing.T) {
	tests := []struct {
		name  string
		level ViewerAccessLevel
		want  []string
	}{
		{name: "public", level: ViewerAccessPublic, want: []string{VisibilityPublic}},
		{name: "follower", level: ViewerAccessFollower, want: []string{VisibilityPublic, VisibilityFollowers}},
		{name: "owner", level: ViewerAccessOwner, want: []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}},
		{name: "admin", level: ViewerAccessAdmin, want: []string{VisibilityPublic, VisibilityFollowers, VisibilityPrivate, VisibilityUnlisted}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := VisibleValuesForLevel(tt.level)
			if len(got) != len(tt.want) {
				t.Fatalf("VisibleValuesForLevel(%q) length = %d, want %d", tt.level, len(got), len(tt.want))
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Fatalf("VisibleValuesForLevel(%q)[%d] = %q, want %q", tt.level, i, got[i], tt.want[i])
				}
			}
		})
	}
}
