package svc

import (
	"os"
	"path/filepath"
	"testing"

	"discover_world/internal/config"
)

func TestStorageSecretLoadsSecretRefPath(t *testing.T) {
	wd, err := os.Getwd()
	if err != nil {
		t.Fatalf("Getwd returned error: %v", err)
	}
	projectRoot := filepath.Join(wd, "..", "..")
	t.Cleanup(func() {
		_ = os.Chdir(wd)
	})
	if err := os.Chdir(projectRoot); err != nil {
		t.Fatalf("Chdir project root returned error: %v", err)
	}

	svcCtx := &ServiceContext{Config: config.Config{}}
	secret := svcCtx.StorageSecret(filepath.Join("etc", "storage", "default.yaml"))
	if secret.SecretId == "" {
		t.Fatal("secret_ref path SecretId is empty")
	}
	if secret.SecretKey == "" {
		t.Fatal("secret_ref path SecretKey is empty")
	}
}
