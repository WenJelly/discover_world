package config

import (
	"os"
	"reflect"
	"strings"
	"testing"
)

func TestRedisFeatureDefaults(t *testing.T) {
	var c Config
	c.Normalize()

	if c.Redis.KeyPrefix != "dw:dev:v1" {
		t.Fatalf("redis key prefix = %q", c.Redis.KeyPrefix)
	}
	if c.Redis.HomepageTTLSeconds != 600 || c.Redis.NotificationUnreadTTLSeconds != 60 {
		t.Fatalf("redis cache TTLs = %#v", c.Redis)
	}
	if c.Redis.RateLimit.LoginIPLimit != 20 || c.Redis.RateLimit.SearchIPLimit != 30 {
		t.Fatalf("redis rate limits = %#v", c.Redis.RateLimit)
	}
	if c.Redis.UploadDailyBytes != 300<<20 {
		t.Fatalf("upload daily bytes = %d", c.Redis.UploadDailyBytes)
	}
}

func TestRedisConfigOwnsConnectionNodes(t *testing.T) {
	redisField, ok := reflect.TypeOf(Config{}).FieldByName("Redis")
	if !ok {
		t.Fatal("Config.Redis is missing")
	}
	if _, ok := redisField.Type.FieldByName("Nodes"); !ok {
		t.Fatal("Config.Redis.Nodes is missing")
	}
}

func TestConfigDoesNotExposeLegacyCacheRedis(t *testing.T) {
	if _, ok := reflect.TypeOf(Config{}).FieldByName("CacheRedis"); ok {
		t.Fatal("legacy Config.CacheRedis still exists")
	}
}

func TestApplicationYAMLUsesSingleRedisSection(t *testing.T) {
	path := "../../etc/application.yaml"
	source, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read application.yaml: %v", err)
	}
	text := string(source)
	if strings.Contains(text, "\nCacheRedis:") {
		t.Fatal("application.yaml still has a top-level CacheRedis section")
	}
	if !strings.Contains(text, "Redis:\n  Nodes:") {
		t.Fatal("application.yaml does not declare Redis.Nodes")
	}
	c, err := Load(path)
	if err != nil {
		t.Fatalf("load application.yaml: %v", err)
	}
	if len(c.Redis.Nodes) != 1 || c.Redis.Nodes[0].Host != "localhost:6379" {
		t.Fatalf("loaded Redis nodes = %#v", c.Redis.Nodes)
	}
}
