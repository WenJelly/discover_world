package config

import (
	"path/filepath"
	"testing"
)

func TestApplicationConfigAllowsConfiguredMediaUploads(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "etc", "application.yaml"))
	if err != nil {
		t.Fatalf("Load application config returned error: %v", err)
	}

	const minMediaUploadRequestBytes = int64(32 << 20)
	if c.MaxBytes < minMediaUploadRequestBytes {
		t.Fatalf("MaxBytes = %d, want at least %d for media uploads", c.MaxBytes, minMediaUploadRequestBytes)
	}

	const minMediaUploadRequestTimeout = int64(65_000)
	if c.Timeout < minMediaUploadRequestTimeout {
		t.Fatalf("Timeout = %d, want at least %d for media uploads", c.Timeout, minMediaUploadRequestTimeout)
	}
}

func TestApplicationConfigLoadsDefaultStorageSecret(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "etc", "application.yaml"))
	if err != nil {
		t.Fatalf("Load application config returned error: %v", err)
	}

	secret := c.StorageSecrets["default"]
	if secret.SecretId == "" {
		t.Fatal("default storage SecretId is empty")
	}
	if secret.SecretKey == "" {
		t.Fatal("default storage SecretKey is empty")
	}
}

func TestApplicationConfigAliasesDefaultStorageSecretPath(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "etc", "application.yaml"))
	if err != nil {
		t.Fatalf("Load application config returned error: %v", err)
	}

	secret := c.StorageSecrets["/etc/storage/config/default.yaml"]
	if secret.SecretId == "" {
		t.Fatal("path alias storage SecretId is empty")
	}
	if secret.SecretKey == "" {
		t.Fatal("path alias storage SecretKey is empty")
	}
}

func TestIpGeoNormalizeKeepsIP2RegionSettings(t *testing.T) {
	cfg := IpGeoConfig{
		Provider: " IP2Region ",
		Ip2Region: Ip2RegionConfig{
			DBPath:     " ./data/ip2region.xdb ",
			IPv6DBPath: " ./data/ip2region_v6.xdb ",
		},
	}

	cfg.Normalize("default-hash-secret")

	if cfg.Provider != "ip2region" {
		t.Fatalf("provider = %q", cfg.Provider)
	}
	if cfg.HashSecret != "default-hash-secret" {
		t.Fatalf("hash secret = %q", cfg.HashSecret)
	}
	if cfg.Ip2Region.DBPath != "./data/ip2region.xdb" {
		t.Fatalf("db path = %q", cfg.Ip2Region.DBPath)
	}
	if cfg.Ip2Region.IPv6DBPath != "./data/ip2region_v6.xdb" {
		t.Fatalf("ipv6 db path = %q", cfg.Ip2Region.IPv6DBPath)
	}
}
