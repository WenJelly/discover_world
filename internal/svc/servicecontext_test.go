package svc

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"discover_world/internal/config"
	"discover_world/model"
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

func TestIsAdminAccountUsesRoleColumnOnly(t *testing.T) {
	svcCtx := &ServiceContext{Config: config.Config{
		Admin: config.AdminConfig{
			Usernames: []string{"configured-admin"},
			Emails:    []string{"admin@example.com"},
		},
	}}

	if !svcCtx.IsAdminAccount(&model.UserAccount{Username: "alice", Role: "admin"}) {
		t.Fatal("role=admin should be treated as admin")
	}
	if svcCtx.IsAdminAccount(&model.UserAccount{Username: "admin", Role: "user"}) {
		t.Fatal("username=admin should not be treated as admin without role=admin")
	}
	if svcCtx.IsAdminAccount(&model.UserAccount{Username: "configured-admin", Role: "user"}) {
		t.Fatal("configured admin username should not be treated as admin without role=admin")
	}
	if svcCtx.IsAdminAccount(&model.UserAccount{Email: sql.NullString{String: "admin@example.com", Valid: true}, Role: "user"}) {
		t.Fatal("configured admin email should not be treated as admin without role=admin")
	}
	if svcCtx.IsAdminAccount(&model.UserAccount{Username: "editor", Role: "editor"}) {
		t.Fatal("non-admin role should not be treated as admin")
	}
}
