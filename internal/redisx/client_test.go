package redisx

import (
	"context"
	"errors"
	"testing"
	"time"
)

type tokenRevocationStore struct {
	values map[string]string
}

func (s *tokenRevocationStore) GetCtx(_ context.Context, key string) (string, error) {
	return s.values[key], nil
}

func (s *tokenRevocationStore) SetexCtx(_ context.Context, key, value string, _ int) error {
	if s.values == nil {
		s.values = make(map[string]string)
	}
	s.values[key] = value
	return nil
}

func (s *tokenRevocationStore) DelCtx(context.Context, ...string) (int, error) {
	return 0, errors.New("not implemented")
}

func (s *tokenRevocationStore) EvalCtx(context.Context, string, []string, ...any) (any, error) {
	return nil, errors.New("not implemented")
}

func (s *tokenRevocationStore) SetnxExCtx(context.Context, string, string, int) (bool, error) {
	return false, errors.New("not implemented")
}

func (s *tokenRevocationStore) IncrCtx(context.Context, string) (int64, error) {
	return 0, errors.New("not implemented")
}

func TestIsTokenRevokedDistinguishesMissingAndRevokedTokens(t *testing.T) {
	store := &tokenRevocationStore{values: make(map[string]string)}
	client := NewClient(store, "dw:test:v1")
	ctx := context.Background()

	revoked, err := client.IsTokenRevoked(ctx, "fresh-token")
	if err != nil {
		t.Fatalf("check fresh token: %v", err)
	}
	if revoked {
		t.Fatal("fresh token without a Redis revocation key was reported as revoked")
	}

	if err := client.RevokeToken(ctx, "revoked-token", time.Minute); err != nil {
		t.Fatalf("revoke token: %v", err)
	}
	revoked, err = client.IsTokenRevoked(ctx, "revoked-token")
	if err != nil {
		t.Fatalf("check revoked token: %v", err)
	}
	if !revoked {
		t.Fatal("token with a Redis revocation key was reported as active")
	}
}
