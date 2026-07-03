package config

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/zeromicro/go-zero/core/conf"
	"go.yaml.in/yaml/v2"
)

const DefaultConfigPath = "etc/application.yaml"

const defaultStorageSecretPath = "etc/storage/config/default.yaml"

func Load(path string) (Config, error) {
	var c Config

	path = strings.TrimSpace(path)
	if path == "" {
		path = DefaultConfigPath
	}

	if err := conf.Load(path, &c); err != nil {
		return c, err
	}

	localPath := localConfigPath(path)
	if _, err := os.Stat(localPath); err == nil {
		var override struct {
			Cos CosConfig `json:",optional"`
		}
		if err := conf.Load(localPath, &override); err != nil {
			return c, err
		}
		c.ApplyCosOverride(override.Cos)
	} else if !os.IsNotExist(err) {
		return c, err
	}

	if err := loadStorageSecrets(&c, storageSecretPathForConfig(path)); err != nil {
		return c, err
	}

	c.Normalize()
	return c, nil
}

func localConfigPath(path string) string {
	ext := filepath.Ext(path)
	if ext == "" {
		return path + ".local"
	}

	return strings.TrimSuffix(path, ext) + ".local" + ext
}

func storageSecretPathForConfig(configPath string) string {
	configDir := filepath.Dir(configPath)
	if filepath.Base(configDir) == "etc" {
		return filepath.Join(filepath.Dir(configDir), "etc", "storage", "config", "default.yaml")
	}
	return defaultStorageSecretPath
}

func loadStorageSecrets(c *Config, path string) error {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var storage struct {
		Default struct {
			SecretId       string `yaml:"SecretId"`
			SecretKey      string `yaml:"SecretKey"`
			LowerSecretId  string `yaml:"secretId"`
			LowerSecretKey string `yaml:"secretKey"`
		} `yaml:"default"`
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := yaml.Unmarshal(data, &storage); err != nil {
		return err
	}

	secret := StorageSecretConfig{
		SecretId:  firstNonEmpty(storage.Default.SecretId, storage.Default.LowerSecretId),
		SecretKey: firstNonEmpty(storage.Default.SecretKey, storage.Default.LowerSecretKey),
	}
	c.ApplyStorageSecret("default", secret)
	c.ApplyStorageSecret(defaultStorageSecretPath, secret)
	c.ApplyStorageSecret("/"+defaultStorageSecretPath, secret)
	c.ApplyStorageSecret(path, secret)
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}
