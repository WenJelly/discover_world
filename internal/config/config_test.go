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
