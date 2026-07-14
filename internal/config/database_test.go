package config

import (
	"path/filepath"
	"testing"
)

func TestMysqlNormalizeAppliesBoundedPoolDefaults(t *testing.T) {
	var c Config
	c.Normalize()

	if c.Mysql.MaxOpenConns != 32 {
		t.Fatalf("max open connections = %d, want 32", c.Mysql.MaxOpenConns)
	}
	if c.Mysql.MaxIdleConns != 32 {
		t.Fatalf("max idle connections = %d, want 32", c.Mysql.MaxIdleConns)
	}
	if c.Mysql.ConnMaxLifetimeSeconds != 1800 {
		t.Fatalf("connection max lifetime = %d, want 1800", c.Mysql.ConnMaxLifetimeSeconds)
	}
	if c.Mysql.ConnMaxIdleTimeSeconds != 300 {
		t.Fatalf("connection max idle time = %d, want 300", c.Mysql.ConnMaxIdleTimeSeconds)
	}
}

func TestMysqlNormalizeClampsIdleConnectionsToOpenLimit(t *testing.T) {
	c := Config{}
	c.Mysql.MaxOpenConns = 12
	c.Mysql.MaxIdleConns = 40
	c.Mysql.ConnMaxLifetimeSeconds = 600
	c.Mysql.ConnMaxIdleTimeSeconds = 120
	c.Normalize()

	if c.Mysql.MaxOpenConns != 12 || c.Mysql.MaxIdleConns != 12 {
		t.Fatalf("normalized pool sizes = (%d, %d), want (12, 12)", c.Mysql.MaxOpenConns, c.Mysql.MaxIdleConns)
	}
	if c.Mysql.ConnMaxLifetimeSeconds != 600 || c.Mysql.ConnMaxIdleTimeSeconds != 120 {
		t.Fatalf("normalized pool lifetimes changed: %#v", c.Mysql)
	}
}

func TestApplicationConfigExposesLocalMetricsAndPoolSettings(t *testing.T) {
	c, err := Load(filepath.Join("..", "..", "etc", "application.yaml"))
	if err != nil {
		t.Fatalf("Load application config returned error: %v", err)
	}

	if c.DevServer.Host != "127.0.0.1" || c.DevServer.Port != 6060 {
		t.Fatalf("dev server address = %s:%d, want 127.0.0.1:6060", c.DevServer.Host, c.DevServer.Port)
	}
	if !c.DevServer.Enabled || !c.DevServer.EnableMetrics || c.DevServer.EnablePprof {
		t.Fatalf("unexpected dev server settings: %#v", c.DevServer)
	}
	if !c.Middlewares.Prometheus {
		t.Fatal("HTTP Prometheus middleware must be enabled")
	}
	if c.Mysql.MaxOpenConns <= 0 || c.Mysql.MaxIdleConns <= 0 {
		t.Fatalf("database pool is not explicitly bounded: %#v", c.Mysql)
	}
}
