package redisx

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/zeromicro/go-zero/core/stores/cache"
	zeroredis "github.com/zeromicro/go-zero/core/stores/redis"
)

func TestRedisIntegration(t *testing.T) {
	addr := os.Getenv("DISCOVER_WORLD_REDIS_ADDR")
	if addr == "" {
		t.Skip("set DISCOVER_WORLD_REDIS_ADDR to run Redis integration test")
	}
	client, err := NewConfiguredClient(cache.CacheConf{{RedisConf: zeroredis.RedisConf{
		Host: addr,
		Type: zeroredis.NodeType,
		Pass: os.Getenv("DISCOVER_WORLD_REDIS_PASS"),
	}}}, "dw:integration:"+time.Now().Format("20060102150405.000000000"))
	if err != nil {
		t.Fatalf("connect Redis: %v", err)
	}
	ctx := context.Background()
	t.Cleanup(func() {
		_ = client.Delete(ctx, "cache:payload", "auth:revoked:token", "ratelimit:test:subject")
	})

	payload := map[string]string{"name": "mountain"}
	if err := client.SetJSON(ctx, "cache:payload", payload, time.Minute); err != nil {
		t.Fatalf("SetJSON: %v", err)
	}
	var got map[string]string
	if found, err := client.GetJSON(ctx, "cache:payload", &got); err != nil || !found || got["name"] != "mountain" {
		t.Fatalf("GetJSON = found=%v value=%v err=%v", found, got, err)
	}
	if decision, err := client.Allow(ctx, "test", "subject", 1, time.Minute); err != nil || !decision.Allowed {
		t.Fatalf("Allow first = %#v err=%v", decision, err)
	}
	if decision, err := client.Allow(ctx, "test", "subject", 1, time.Minute); err != nil || decision.Allowed {
		t.Fatalf("Allow second = %#v err=%v", decision, err)
	}
	release, acquired, err := client.TryLock(ctx, "integration", time.Minute)
	if err != nil || !acquired {
		t.Fatalf("TryLock = acquired=%v err=%v", acquired, err)
	}
	if err := release(ctx); err != nil {
		t.Fatalf("release lock: %v", err)
	}
	if err := client.RevokeToken(ctx, "token", time.Minute); err != nil {
		t.Fatalf("RevokeToken: %v", err)
	}
	if revoked, err := client.IsTokenRevoked(ctx, "token"); err != nil || !revoked {
		t.Fatalf("IsTokenRevoked = %v err=%v", revoked, err)
	}
}
