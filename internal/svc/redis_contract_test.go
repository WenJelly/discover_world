package svc

import (
	"os"
	"strings"
	"testing"
)

func TestServiceContextExposesRedisFeatures(t *testing.T) {
	svcCtx := &ServiceContext{}
	if svcCtx.Redis != nil {
		t.Fatal("zero service context should not have redis")
	}
	if svcCtx.LoginRateLimit != nil || svcCtx.RegisterRateLimit != nil || svcCtx.SearchRateLimit != nil {
		t.Fatal("zero service context should not have rate limit middleware")
	}
}

func TestServiceContextRequiresConfiguredRedisAtStartup(t *testing.T) {
	source, err := os.ReadFile("servicecontext.go")
	if err != nil {
		t.Fatalf("read servicecontext.go: %v", err)
	}
	if !strings.Contains(string(source), "if redisClient == nil") {
		t.Fatal("NewServiceContext does not reject a missing Redis configuration")
	}
	if !strings.Contains(string(source), "NewConfiguredClient(c.Redis.Nodes, c.Redis.KeyPrefix)") {
		t.Fatal("NewServiceContext does not build Redis from the unified Redis.Nodes config")
	}
}
