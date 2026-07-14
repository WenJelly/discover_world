package redisx

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	zeroredis "github.com/zeromicro/go-zero/core/stores/redis"
)

type fakeStore struct {
	values      map[string]string
	evalResults []any
	evalKeys    [][]string
	setNX       bool
}

func (f *fakeStore) GetCtx(_ context.Context, key string) (string, error) {
	if value, ok := f.values[key]; ok {
		return value, nil
	}
	return "", zeroredis.Nil
}

func (f *fakeStore) SetexCtx(_ context.Context, key, value string, _ int) error {
	if f.values == nil {
		f.values = map[string]string{}
	}
	f.values[key] = value
	return nil
}

func (f *fakeStore) DelCtx(_ context.Context, keys ...string) (int, error) {
	for _, key := range keys {
		delete(f.values, key)
	}
	return len(keys), nil
}

func (f *fakeStore) EvalCtx(_ context.Context, _ string, keys []string, _ ...any) (any, error) {
	f.evalKeys = append(f.evalKeys, append([]string{}, keys...))
	if len(f.evalResults) == 0 {
		return nil, errors.New("missing eval result")
	}
	result := f.evalResults[0]
	f.evalResults = f.evalResults[1:]
	return result, nil
}

func (f *fakeStore) SetnxExCtx(_ context.Context, key, value string, _ int) (bool, error) {
	if !f.setNX {
		return false, nil
	}
	if f.values == nil {
		f.values = map[string]string{}
	}
	f.values[key] = value
	return true, nil
}

func (f *fakeStore) IncrCtx(_ context.Context, key string) (int64, error) {
	if f.values == nil {
		f.values = map[string]string{}
	}
	f.values[key] = "2"
	return 2, nil
}

func TestClientBuildsNamespacedKeysAndHashesSensitiveSubjects(t *testing.T) {
	client := NewClient(&fakeStore{}, "dw:test:v1")

	if got := client.Key("cache", "homepage", "1"); got != "dw:test:v1:cache:homepage:1" {
		t.Fatalf("key = %q", got)
	}
	hashed := HashSubject("secret", "alice@example.com")
	if hashed == "" || hashed == "alice@example.com" {
		t.Fatalf("sensitive subject was not hashed: %q", hashed)
	}
	if hashed != HashSubject("secret", "alice@example.com") {
		t.Fatal("subject hash must be deterministic")
	}
}

func TestJSONCacheRoundTripAndMiss(t *testing.T) {
	store := &fakeStore{values: map[string]string{}}
	client := NewClient(store, "dw:test:v1")
	type payload struct {
		Name string `json:"name"`
	}

	found, err := client.GetJSON(context.Background(), "cache:item", &payload{})
	if err != nil || found {
		t.Fatalf("empty cache = (%v, %v), want miss", found, err)
	}
	if err := client.SetJSON(context.Background(), "cache:item", payload{Name: "mountain"}, time.Minute); err != nil {
		t.Fatalf("SetJSON: %v", err)
	}
	var got payload
	found, err = client.GetJSON(context.Background(), "cache:item", &got)
	if err != nil || !found || got.Name != "mountain" {
		t.Fatalf("cached payload = (%v, %#v, %v)", found, got, err)
	}
}

func TestRateLimitAndQuotaUseAtomicResults(t *testing.T) {
	store := &fakeStore{evalResults: []any{
		[]any{int64(3), int64(60)},
		[]any{int64(4), int64(59)},
		[]any{int64(1), int64(300)},
		[]any{int64(0), int64(300)},
	}}
	client := NewClient(store, "dw:test:v1")

	decision, err := client.Allow(context.Background(), "login", "subject", 3, time.Minute)
	if err != nil || !decision.Allowed || decision.Remaining != 0 {
		t.Fatalf("allowed decision = %#v, err=%v", decision, err)
	}
	decision, err = client.Allow(context.Background(), "login", "subject", 3, time.Minute)
	if err != nil || decision.Allowed {
		t.Fatalf("blocked decision = %#v, err=%v", decision, err)
	}

	quota, err := client.ConsumeQuota(context.Background(), "upload", "7", 300, 1000, 24*time.Hour)
	if err != nil || !quota.Allowed || quota.Used != 300 {
		t.Fatalf("allowed quota = %#v, err=%v", quota, err)
	}
	quota, err = client.ConsumeQuota(context.Background(), "upload", "7", 800, 1000, 24*time.Hour)
	if err != nil || quota.Allowed {
		t.Fatalf("blocked quota = %#v, err=%v", quota, err)
	}
}

func TestLockReleaseVersionAndTokenRevocation(t *testing.T) {
	store := &fakeStore{
		values: map[string]string{},
		setNX:  true,
		evalResults: []any{
			int64(1),
		},
	}
	client := NewClient(store, "dw:test:v1")

	release, acquired, err := client.TryLock(context.Background(), "ranking:media", time.Minute)
	if err != nil || !acquired || release == nil {
		t.Fatalf("TryLock = (%v, %v, %v)", release, acquired, err)
	}
	if err := release(context.Background()); err != nil {
		t.Fatalf("release lock: %v", err)
	}

	version, err := client.BumpVersion(context.Background(), "homepage")
	if err != nil || version != 2 {
		t.Fatalf("version = %d, err=%v", version, err)
	}

	if err := client.RevokeToken(context.Background(), "token-1", time.Minute); err != nil {
		t.Fatalf("RevokeToken: %v", err)
	}
	revoked, err := client.IsTokenRevoked(context.Background(), "token-1")
	if err != nil || !revoked {
		t.Fatalf("revoked = %v, err=%v", revoked, err)
	}

	wantEvalKeys := [][]string{{client.Key("lock", "ranking:media")}}
	if !reflect.DeepEqual(store.evalKeys, wantEvalKeys) {
		t.Fatalf("eval keys = %#v, want %#v", store.evalKeys, wantEvalKeys)
	}
}
