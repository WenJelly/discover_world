package redisx

import (
	"os"
	"strings"
	"testing"
)

func TestRedisClientExposesCacheAndLockMetrics(t *testing.T) {
	source, err := os.ReadFile("client.go")
	if err != nil {
		t.Fatalf("read client.go: %v", err)
	}
	text := string(source)
	for _, fragment := range []string{
		`Subsystem: "redis_cache"`,
		`Subsystem: "redis_lock"`,
		`redisCacheRequests.Inc("json", "hit")`,
		`redisLockRequests.Inc("acquired")`,
	} {
		if !strings.Contains(text, fragment) {
			t.Fatalf("client.go missing metric fragment %q", fragment)
		}
	}
}
