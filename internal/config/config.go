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

type RankingConfig struct {
	RefreshIntervalSeconds int64 `json:",optional"`
	BatchSize              int64 `json:",optional"`
}

type RedisRateLimitConfig struct {
	LoginIPLimit        int64 `json:",optional"`
	LoginAccountLimit   int64 `json:",optional"`
	RegisterIPLimit     int64 `json:",optional"`
	SearchIPLimit       int64 `json:",optional"`
	UploadInitUserLimit int64 `json:",optional"`
	DownloadUserLimit   int64 `json:",optional"`
}

type RedisConfig struct {
	Nodes                        cache.CacheConf      `json:",optional"`
	KeyPrefix                    string               `json:",optional"`
	HomepageTTLSeconds           int64                `json:",optional"`
	NotificationUnreadTTLSeconds int64                `json:",optional"`
	UploadCompleteLockSeconds    int64                `json:",optional"`
	RankingLockSeconds           int64                `json:",optional"`
	UploadDailyBytes             int64                `json:",optional"`
	RateLimit                    RedisRateLimitConfig `json:",optional"`
}

type MysqlConfig struct {
	DataSource             string
	MaxOpenConns           int   `json:",optional"`
	MaxIdleConns           int   `json:",optional"`
	ConnMaxLifetimeSeconds int64 `json:",optional"`
	ConnMaxIdleTimeSeconds int64 `json:",optional"`
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

	Mysql MysqlConfig
	Redis RedisConfig

	Auth struct {
		AccessSecret string
		AccessExpire int64
	}

	Cos CosConfig

	Admin          AdminConfig
	Ranking        RankingConfig
	IpGeo          IpGeoConfig
	StorageSecrets map[string]StorageSecretConfig `json:",optional"`
}

func (c *Config) Normalize() {
	c.Cos.Normalize()
	c.Mysql.Normalize()
	c.Redis.Normalize()
	c.Ranking.Normalize()
	c.IpGeo.Normalize(c.Auth.AccessSecret)
}

func (c *RedisConfig) Normalize() {
	if strings.TrimSpace(c.KeyPrefix) == "" {
		c.KeyPrefix = "dw:dev:v1"
	}
	if c.HomepageTTLSeconds <= 0 {
		c.HomepageTTLSeconds = 600
	}
	if c.NotificationUnreadTTLSeconds <= 0 {
		c.NotificationUnreadTTLSeconds = 60
	}
	if c.UploadCompleteLockSeconds <= 0 {
		c.UploadCompleteLockSeconds = 30
	}
	if c.RankingLockSeconds <= 0 {
		c.RankingLockSeconds = 7200
	}
	if c.UploadDailyBytes <= 0 {
		c.UploadDailyBytes = 300 << 20
	}
	if c.RateLimit.LoginIPLimit <= 0 {
		c.RateLimit.LoginIPLimit = 20
	}
	if c.RateLimit.LoginAccountLimit <= 0 {
		c.RateLimit.LoginAccountLimit = 5
	}
	if c.RateLimit.RegisterIPLimit <= 0 {
		c.RateLimit.RegisterIPLimit = 10
	}
	if c.RateLimit.SearchIPLimit <= 0 {
		c.RateLimit.SearchIPLimit = 30
	}
	if c.RateLimit.UploadInitUserLimit <= 0 {
		c.RateLimit.UploadInitUserLimit = 20
	}
	if c.RateLimit.DownloadUserLimit <= 0 {
		c.RateLimit.DownloadUserLimit = 60
	}
}

func (c *MysqlConfig) Normalize() {
	if c.MaxOpenConns <= 0 {
		c.MaxOpenConns = 32
	}
	if c.MaxIdleConns <= 0 {
		c.MaxIdleConns = c.MaxOpenConns
	}
	if c.MaxIdleConns > c.MaxOpenConns {
		c.MaxIdleConns = c.MaxOpenConns
	}
	if c.ConnMaxLifetimeSeconds <= 0 {
		c.ConnMaxLifetimeSeconds = 1800
	}
	if c.ConnMaxIdleTimeSeconds <= 0 {
		c.ConnMaxIdleTimeSeconds = 300
	}
}

func (c *RankingConfig) Normalize() {
	if c.RefreshIntervalSeconds <= 0 {
		c.RefreshIntervalSeconds = 3600
	}
	if c.BatchSize <= 0 {
		c.BatchSize = 1000
	}
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
