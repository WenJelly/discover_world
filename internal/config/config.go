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

type IpGeoStaticRule struct {
	CIDR            string `json:",optional"`
	Country         string `json:",optional"`
	Province        string `json:",optional"`
	City            string `json:",optional"`
	District        string `json:",optional"`
	ISP             string `json:",optional"`
	DisplayLocation string `json:",optional"`
	Provider        string `json:",optional"`
	ProviderVersion string `json:",optional"`
}

type Ip2RegionConfig struct {
	DBPath      string `json:",optional"`
	IPv4DBPath  string `json:",optional"`
	IPv6DBPath  string `json:",optional"`
	CachePolicy string `json:",optional"`
	Searchers   int    `json:",optional"`
}

type IpGeoConfig struct {
	Enabled        bool              `json:",optional"`
	Provider       string            `json:",optional"`
	HashSecret     string            `json:",optional"`
	TrustedProxies []string          `json:",optional"`
	Ip2Region      Ip2RegionConfig   `json:",optional"`
	StaticRules    []IpGeoStaticRule `json:",optional"`
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
	IpGeo          IpGeoConfig
	StorageSecrets map[string]StorageSecretConfig `json:",optional"`
}

func (c *Config) Normalize() {
	c.Cos.Normalize()
	c.IpGeo.Normalize(c.Auth.AccessSecret)
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

func (c *IpGeoConfig) Normalize(defaultHashSecret string) {
	c.Provider = strings.ToLower(strings.TrimSpace(c.Provider))
	if c.Provider == "" {
		c.Provider = "static"
	}
	if strings.TrimSpace(c.HashSecret) == "" {
		c.HashSecret = defaultHashSecret
	}
	c.Ip2Region.Normalize()
}

func (c *Ip2RegionConfig) Normalize() {
	c.DBPath = strings.TrimSpace(c.DBPath)
	c.IPv4DBPath = strings.TrimSpace(c.IPv4DBPath)
	c.IPv6DBPath = strings.TrimSpace(c.IPv6DBPath)
	c.CachePolicy = strings.TrimSpace(c.CachePolicy)
	if c.IPv4DBPath == "" {
		c.IPv4DBPath = c.DBPath
	}
	if c.DBPath == "" {
		c.DBPath = c.IPv4DBPath
	}
	if c.CachePolicy == "" {
		c.CachePolicy = "vectorIndex"
	}
	if c.Searchers <= 0 {
		c.Searchers = 20
	}
}
