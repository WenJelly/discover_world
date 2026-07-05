package model

import "testing"

func TestNormalizeEntityStatCounterWhitelistsCounters(t *testing.T) {
	tests := []string{
		"view_count",
		"reaction_count",
		"favorite_count",
		"comment_count",
		"share_count",
		"download_count",
	}

	for _, counter := range tests {
		t.Run(counter, func(t *testing.T) {
			got, err := normalizeEntityStatCounter(counter)
			if err != nil {
				t.Fatalf("normalizeEntityStatCounter returned error: %v", err)
			}
			if got != counter {
				t.Fatalf("normalizeEntityStatCounter = %q, want %q", got, counter)
			}
		})
	}

	if _, err := normalizeEntityStatCounter("reaction_count = reaction_count + 99"); err == nil {
		t.Fatal("normalizeEntityStatCounter accepted an unsafe column name")
	}
}
