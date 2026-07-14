package svc

import (
	"testing"
	"time"

	"discover_world/internal/config"
)

type recordingDatabasePool struct {
	maxOpen     int
	maxIdle     int
	maxLifetime time.Duration
	maxIdleTime time.Duration
}

func (p *recordingDatabasePool) SetMaxOpenConns(value int) {
	p.maxOpen = value
}

func (p *recordingDatabasePool) SetMaxIdleConns(value int) {
	p.maxIdle = value
}

func (p *recordingDatabasePool) SetConnMaxLifetime(value time.Duration) {
	p.maxLifetime = value
}

func (p *recordingDatabasePool) SetConnMaxIdleTime(value time.Duration) {
	p.maxIdleTime = value
}

func TestApplyDatabasePoolSettings(t *testing.T) {
	pool := &recordingDatabasePool{}
	applyDatabasePoolSettings(pool, config.MysqlConfig{
		MaxOpenConns:           24,
		MaxIdleConns:           12,
		ConnMaxLifetimeSeconds: 900,
		ConnMaxIdleTimeSeconds: 180,
	})

	if pool.maxOpen != 24 || pool.maxIdle != 12 {
		t.Fatalf("pool sizes = (%d, %d), want (24, 12)", pool.maxOpen, pool.maxIdle)
	}
	if pool.maxLifetime != 15*time.Minute || pool.maxIdleTime != 3*time.Minute {
		t.Fatalf("pool lifetimes = (%s, %s), want (15m, 3m)", pool.maxLifetime, pool.maxIdleTime)
	}
}
