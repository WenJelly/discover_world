package config

import "testing"

func TestConfigNormalizeSetsMediaRankingRefreshDefaults(t *testing.T) {
	var c Config
	c.Normalize()

	if c.Ranking.RefreshIntervalSeconds != 3600 {
		t.Fatalf("ranking refresh interval = %d, want 3600", c.Ranking.RefreshIntervalSeconds)
	}
	if c.Ranking.BatchSize != 1000 {
		t.Fatalf("ranking batch size = %d, want 1000", c.Ranking.BatchSize)
	}
}

func TestConfigNormalizeKeepsMediaRankingRefreshOverrides(t *testing.T) {
	c := Config{}
	c.Ranking.RefreshIntervalSeconds = 600
	c.Ranking.BatchSize = 250
	c.Normalize()

	if c.Ranking.RefreshIntervalSeconds != 600 || c.Ranking.BatchSize != 250 {
		t.Fatalf("ranking overrides changed: %#v", c.Ranking)
	}
}
