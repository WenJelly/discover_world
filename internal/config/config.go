// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package config

import (
	"strings"

	"github.com/zeromicro/go-zero/core/stores/cache"
	"github.com/zeromicro/go-zero/rest"
)

type CosConfig struct {
	Host      string `json:",optional"`
	SecretId  string `json:",optional"`
	SecretKey string `json:",optional"`
	Region    string `json:",optional"`
	Bucket    string `json:",optional"`
	Client    struct {
		Host      string `json:",optional"`
		SecretId  string `json:",optional"`
		SecretKey string `json:",optional"`
		Region    string `json:",optional"`
		Bucket    string `json:",optional"`
	} `json:",optional"`
}

type StorageSecretConfig struct {
	SecretId  string `json:",optional"`
	SecretKey string `json:",optional"`
}

type AdminConfig struct {
	Usernames []string `json:",optional"`
	Emails    []string `json:",optional"`
}

type Config struct {
	rest.RestConf

	Mysql struct {
		DataSource string
	}
	CacheRedis cache.CacheConf

	Auth struct {
		AccessSecret string
		AccessExpire int64
	}

	Cos CosConfig

	Admin          AdminConfig
	StorageSecrets map[string]StorageSecretConfig `json:",optional"`
}

func (c *Config) Normalize() {
	c.Cos.Normalize()
}

func (c *Config) ApplyCosOverride(override CosConfig) {
	c.Cos.ApplyOverride(override)
}

func (c *Config) ApplyStorageSecret(ref string, secret StorageSecretConfig) {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return
	}
	if strings.TrimSpace(secret.SecretId) == "" && strings.TrimSpace(secret.SecretKey) == "" {
		return
	}
	if c.StorageSecrets == nil {
		c.StorageSecrets = make(map[string]StorageSecretConfig)
	}
	c.StorageSecrets[ref] = secret
}

func (c *CosConfig) Normalize() {
	if value := strings.TrimSpace(c.Client.Host); value != "" {
		c.Host = value
	}
	if value := strings.TrimSpace(c.Client.SecretId); value != "" {
		c.SecretId = value
	}
	if value := strings.TrimSpace(c.Client.SecretKey); value != "" {
		c.SecretKey = value
	}
	if value := strings.TrimSpace(c.Client.Region); value != "" {
		c.Region = value
	}
	if value := strings.TrimSpace(c.Client.Bucket); value != "" {
		c.Bucket = value
	}
}

func (c *CosConfig) ApplyOverride(override CosConfig) {
	if value := strings.TrimSpace(override.Host); value != "" {
		c.Host = value
	}
	if value := strings.TrimSpace(override.SecretId); value != "" {
		c.SecretId = value
	}
	if value := strings.TrimSpace(override.SecretKey); value != "" {
		c.SecretKey = value
	}
	if value := strings.TrimSpace(override.Region); value != "" {
		c.Region = value
	}
	if value := strings.TrimSpace(override.Bucket); value != "" {
		c.Bucket = value
	}
	if value := strings.TrimSpace(override.Client.Host); value != "" {
		c.Client.Host = value
	}
	if value := strings.TrimSpace(override.Client.SecretId); value != "" {
		c.Client.SecretId = value
	}
	if value := strings.TrimSpace(override.Client.SecretKey); value != "" {
		c.Client.SecretKey = value
	}
	if value := strings.TrimSpace(override.Client.Region); value != "" {
		c.Client.Region = value
	}
	if value := strings.TrimSpace(override.Client.Bucket); value != "" {
		c.Client.Bucket = value
	}
}
