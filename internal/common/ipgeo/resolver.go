package ipgeo

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/netip"
	"strings"

	"discover_world/internal/config"

	"github.com/zeromicro/go-zero/core/logx"
)

type Region struct {
	Country         string
	Province        string
	City            string
	District        string
	ISP             string
	DisplayLocation string
	Provider        string
	ProviderVersion string
}

type StaticRule struct {
	CIDR            string
	Country         string
	Province        string
	City            string
	District        string
	ISP             string
	DisplayLocation string
	Provider        string
	ProviderVersion string
}

type Resolver interface {
	Resolve(ctx context.Context, addr netip.Addr) (Region, bool, error)
}

type staticResolver struct {
	rules []compiledStaticRule
}

type compiledStaticRule struct {
	prefix netip.Prefix
	region Region
}

func NewResolver(cfg config.IpGeoConfig) Resolver {
	if strings.EqualFold(strings.TrimSpace(cfg.Provider), "ip2region") {
		resolver, err := NewIP2RegionResolver(cfg.Ip2Region)
		if err != nil {
			logx.Errorf("create ip2region resolver failed: %v", err)
			return NewStaticResolver(configRulesToStaticRules(cfg.StaticRules))
		}
		return resolver
	}
	return NewStaticResolver(configRulesToStaticRules(cfg.StaticRules))
}

func NewStaticResolver(rules []StaticRule) Resolver {
	compiled := make([]compiledStaticRule, 0, len(rules))
	for _, rule := range rules {
		prefix, err := netip.ParsePrefix(strings.TrimSpace(rule.CIDR))
		if err != nil {
			continue
		}
		compiled = append(compiled, compiledStaticRule{
			prefix: prefix,
			region: normalizeRegion(Region{
				Country:         rule.Country,
				Province:        rule.Province,
				City:            rule.City,
				District:        rule.District,
				ISP:             rule.ISP,
				DisplayLocation: rule.DisplayLocation,
				Provider:        firstNonEmpty(rule.Provider, "static"),
				ProviderVersion: rule.ProviderVersion,
			}),
		})
	}
	return &staticResolver{rules: compiled}
}

func (r *staticResolver) Resolve(_ context.Context, addr netip.Addr) (Region, bool, error) {
	if r == nil || !addr.IsValid() {
		return Region{}, false, nil
	}
	addr = addr.Unmap()
	for _, rule := range r.rules {
		if rule.prefix.Contains(addr) {
			return rule.region, true, nil
		}
	}
	return Region{}, false, nil
}

func HashIP(addr netip.Addr, secret string) string {
	if !addr.IsValid() {
		return ""
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(addr.Unmap().String()))
	return hex.EncodeToString(mac.Sum(nil))
}

func normalizeRegion(region Region) Region {
	region.Country = strings.TrimSpace(region.Country)
	region.Province = strings.TrimSpace(region.Province)
	region.City = strings.TrimSpace(region.City)
	region.District = strings.TrimSpace(region.District)
	region.ISP = strings.TrimSpace(region.ISP)
	region.DisplayLocation = strings.TrimSpace(region.DisplayLocation)
	region.Provider = strings.TrimSpace(region.Provider)
	region.ProviderVersion = strings.TrimSpace(region.ProviderVersion)
	if region.DisplayLocation == "" {
		region.DisplayLocation = buildDisplayLocation(region)
	}
	return region
}

func buildDisplayLocation(region Region) string {
	parts := make([]string, 0, 2)
	if region.Country != "" {
		parts = append(parts, region.Country)
	}
	local := firstNonEmpty(region.City, region.Province, region.District)
	if local != "" && local != region.Country {
		parts = append(parts, local)
	}
	return strings.Join(parts, " · ")
}

func configRulesToStaticRules(rules []config.IpGeoStaticRule) []StaticRule {
	resp := make([]StaticRule, 0, len(rules))
	for _, rule := range rules {
		resp = append(resp, StaticRule{
			CIDR:            rule.CIDR,
			Country:         rule.Country,
			Province:        rule.Province,
			City:            rule.City,
			District:        rule.District,
			ISP:             rule.ISP,
			DisplayLocation: rule.DisplayLocation,
			Provider:        rule.Provider,
			ProviderVersion: rule.ProviderVersion,
		})
	}
	return resp
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
