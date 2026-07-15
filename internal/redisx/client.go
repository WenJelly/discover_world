package redisx

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/metric"
	"github.com/zeromicro/go-zero/core/stores/cache"
	zeroredis "github.com/zeromicro/go-zero/core/stores/redis"
)

var ErrUnavailable = errors.New("redis unavailable")

var (
	redisCacheRequests = metric.NewCounterVec(&metric.CounterVecOpts{
		Namespace: "discover_world",
		Subsystem: "redis_cache",
		Name:      "requests_total",
		Help:      "Redis cache reads by kind and result.",
		Labels:    []string{"kind", "result"},
	})
	redisLockRequests = metric.NewCounterVec(&metric.CounterVecOpts{
		Namespace: "discover_world",
		Subsystem: "redis_lock",
		Name:      "requests_total",
		Help:      "Redis distributed lock acquisition results.",
		Labels:    []string{"result"},
	})
)

const (
	fixedWindowScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}`
	quotaScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local delta = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
if current + delta > limit then return {0, current} end
local next = redis.call('INCRBY', KEYS[1], delta)
if current == 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return {1, next}`
	unlockScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`
)

type Store interface {
	GetCtx(ctx context.Context, key string) (string, error)
	SetexCtx(ctx context.Context, key, value string, seconds int) error
	DelCtx(ctx context.Context, keys ...string) (int, error)
	EvalCtx(ctx context.Context, script string, keys []string, args ...any) (any, error)
	SetnxExCtx(ctx context.Context, key, value string, seconds int) (bool, error)
	IncrCtx(ctx context.Context, key string) (int64, error)
}

type Client struct {
	store  Store
	prefix string
}

type RateDecision struct {
	Allowed    bool
	Remaining  int64
	RetryAfter time.Duration
}

type QuotaDecision struct {
	Allowed bool
	Used    int64
}

type ReleaseFunc func(context.Context) error

func NewClient(store Store, prefix string) *Client {
	prefix = strings.Trim(strings.TrimSpace(prefix), ":")
	if prefix == "" {
		prefix = "dw:dev:v1"
	}
	return &Client{store: store, prefix: prefix}
}

func NewConfiguredClient(conf cache.CacheConf, prefix string) (*Client, error) {
	if len(conf) == 0 {
		return nil, nil
	}
	store, err := zeroredis.NewRedis(conf[0].RedisConf)
	if err != nil {
		return nil, err
	}
	pingTimeout := conf[0].PingTimeout
	if pingTimeout <= 0 {
		pingTimeout = time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), pingTimeout)
	defer cancel()
	if !store.PingCtx(ctx) {
		return nil, ErrUnavailable
	}
	return NewClient(store, prefix), nil
}

func (c *Client) Key(parts ...string) string {
	items := make([]string, 0, len(parts)+1)
	items = append(items, c.prefix)
	for _, part := range parts {
		part = strings.Trim(strings.TrimSpace(part), ":")
		if part != "" {
			items = append(items, part)
		}
	}
	return strings.Join(items, ":")
}

func HashSubject(secret, value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(mac.Sum(nil))
}

func (c *Client) GetJSON(ctx context.Context, key string, out any) (bool, error) {
	if c == nil || c.store == nil {
		redisCacheRequests.Inc("json", "error")
		return false, ErrUnavailable
	}
	value, err := c.store.GetCtx(ctx, c.Key(key))
	if errors.Is(err, zeroredis.Nil) {
		redisCacheRequests.Inc("json", "miss")
		return false, nil
	}
	if err != nil {
		redisCacheRequests.Inc("json", "error")
		return false, err
	}
	if err := json.Unmarshal([]byte(value), out); err != nil {
		redisCacheRequests.Inc("json", "error")
		return false, err
	}
	redisCacheRequests.Inc("json", "hit")
	return true, nil
}

func (c *Client) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	if c == nil || c.store == nil {
		return ErrUnavailable
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.store.SetexCtx(ctx, c.Key(key), string(data), ttlSeconds(ttl))
}

func (c *Client) Delete(ctx context.Context, keys ...string) error {
	if c == nil || c.store == nil {
		return ErrUnavailable
	}
	qualified := make([]string, 0, len(keys))
	for _, key := range keys {
		qualified = append(qualified, c.Key(key))
	}
	_, err := c.store.DelCtx(ctx, qualified...)
	return err
}

func (c *Client) Allow(ctx context.Context, scope, subject string, limit int64, window time.Duration) (RateDecision, error) {
	if c == nil || c.store == nil {
		return RateDecision{}, ErrUnavailable
	}
	result, err := c.store.EvalCtx(ctx, fixedWindowScript, []string{c.Key("ratelimit", scope, subject)}, ttlSeconds(window))
	if err != nil {
		return RateDecision{}, err
	}
	values, err := int64Slice(result, 2)
	if err != nil {
		return RateDecision{}, err
	}
	remaining := limit - values[0]
	if remaining < 0 {
		remaining = 0
	}
	retryAfter := time.Duration(values[1]) * time.Second
	if retryAfter < 0 {
		retryAfter = 0
	}
	return RateDecision{Allowed: values[0] <= limit, Remaining: remaining, RetryAfter: retryAfter}, nil
}

func (c *Client) ConsumeQuota(ctx context.Context, scope, subject string, delta, limit int64, ttl time.Duration) (QuotaDecision, error) {
	if c == nil || c.store == nil {
		return QuotaDecision{}, ErrUnavailable
	}
	result, err := c.store.EvalCtx(ctx, quotaScript, []string{c.Key("quota", scope, subject)}, delta, limit, ttlSeconds(ttl))
	if err != nil {
		return QuotaDecision{}, err
	}
	values, err := int64Slice(result, 2)
	if err != nil {
		return QuotaDecision{}, err
	}
	return QuotaDecision{Allowed: values[0] == 1, Used: values[1]}, nil
}

func (c *Client) TryLock(ctx context.Context, name string, ttl time.Duration) (ReleaseFunc, bool, error) {
	if c == nil || c.store == nil {
		redisLockRequests.Inc("error")
		return nil, false, ErrUnavailable
	}
	token, err := randomToken()
	if err != nil {
		redisLockRequests.Inc("error")
		return nil, false, err
	}
	key := c.Key("lock", name)
	acquired, err := c.store.SetnxExCtx(ctx, key, token, ttlSeconds(ttl))
	if err != nil {
		redisLockRequests.Inc("error")
		return nil, false, err
	}
	if !acquired {
		redisLockRequests.Inc("contended")
		return nil, false, nil
	}
	redisLockRequests.Inc("acquired")
	release := func(releaseCtx context.Context) error {
		_, err := c.store.EvalCtx(releaseCtx, unlockScript, []string{key}, token)
		return err
	}
	return release, true, nil
}

func (c *Client) BumpVersion(ctx context.Context, namespace string) (int64, error) {
	if c == nil || c.store == nil {
		return 0, ErrUnavailable
	}
	return c.store.IncrCtx(ctx, c.Key("version", namespace))
}

func (c *Client) Version(ctx context.Context, namespace string) (string, error) {
	if c == nil || c.store == nil {
		return "", ErrUnavailable
	}
	value, err := c.store.GetCtx(ctx, c.Key("version", namespace))
	if errors.Is(err, zeroredis.Nil) {
		return "0", nil
	}
	return value, err
}

func (c *Client) RevokeToken(ctx context.Context, tokenID string, ttl time.Duration) error {
	if strings.TrimSpace(tokenID) == "" {
		return errors.New("token id is empty")
	}
	if c == nil || c.store == nil {
		return ErrUnavailable
	}
	return c.store.SetexCtx(ctx, c.Key("auth", "revoked", tokenID), "1", ttlSeconds(ttl))
}

func (c *Client) IsTokenRevoked(ctx context.Context, tokenID string) (bool, error) {
	if strings.TrimSpace(tokenID) == "" {
		return false, nil
	}
	if c == nil || c.store == nil {
		return false, ErrUnavailable
	}
	value, err := c.store.GetCtx(ctx, c.Key("auth", "revoked", tokenID))
	if err != nil {
		return false, err
	}
	return strings.TrimSpace(value) == "1", nil
}

func (c *Client) GetInt64(ctx context.Context, key string) (int64, bool, error) {
	if c == nil || c.store == nil {
		redisCacheRequests.Inc("int64", "error")
		return 0, false, ErrUnavailable
	}
	value, err := c.store.GetCtx(ctx, c.Key(key))
	if errors.Is(err, zeroredis.Nil) {
		redisCacheRequests.Inc("int64", "miss")
		return 0, false, nil
	}
	if err != nil {
		redisCacheRequests.Inc("int64", "error")
		return 0, false, err
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		redisCacheRequests.Inc("int64", "error")
	} else {
		redisCacheRequests.Inc("int64", "hit")
	}
	return parsed, err == nil, err
}

func (c *Client) SetInt64(ctx context.Context, key string, value int64, ttl time.Duration) error {
	if c == nil || c.store == nil {
		return ErrUnavailable
	}
	return c.store.SetexCtx(ctx, c.Key(key), strconv.FormatInt(value, 10), ttlSeconds(ttl))
}

func ttlSeconds(ttl time.Duration) int {
	if ttl <= 0 {
		return 1
	}
	return int(math.Ceil(ttl.Seconds()))
}

func int64Slice(value any, minimum int) ([]int64, error) {
	items, ok := value.([]any)
	if !ok || len(items) < minimum {
		return nil, fmt.Errorf("unexpected redis result: %#v", value)
	}
	result := make([]int64, 0, len(items))
	for _, item := range items {
		switch typed := item.(type) {
		case int64:
			result = append(result, typed)
		case int:
			result = append(result, int64(typed))
		case string:
			parsed, err := strconv.ParseInt(typed, 10, 64)
			if err != nil {
				return nil, err
			}
			result = append(result, parsed)
		case []byte:
			parsed, err := strconv.ParseInt(string(typed), 10, 64)
			if err != nil {
				return nil, err
			}
			result = append(result, parsed)
		default:
			return nil, fmt.Errorf("unexpected redis number: %#v", item)
		}
	}
	return result, nil
}

func randomToken() (string, error) {
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}
