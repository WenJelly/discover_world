package config

import "testing"

func TestDefaultConfigPathUsesGoctlServiceName(t *testing.T) {
	if DefaultConfigPath != "etc/discoverworld.yaml" {
		t.Fatalf("DefaultConfigPath = %q", DefaultConfigPath)
	}
}
