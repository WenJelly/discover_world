package ipgeo

import (
	"context"
	"fmt"
	"net/netip"
	"strings"
	"unicode"

	"discover_world/internal/config"

	ip2regionservice "github.com/lionsoul2014/ip2region/binding/golang/service"
)

type ip2RegionSearcher interface {
	Search(ip string) (string, error)
}

type ip2RegionResolver struct {
	ipv4  ip2RegionSearcher
	ipv6  ip2RegionSearcher
	close func()
}

type ip2RegionServiceSearcher struct {
	service *ip2regionservice.Ip2Region
}

var buildIP2RegionSearcher = buildIP2RegionServiceSearcher

func NewIP2RegionResolver(cfg config.Ip2RegionConfig) (Resolver, error) {
	cfg.Normalize()
	if cfg.IPv4DBPath == "" && cfg.IPv6DBPath == "" {
		return newIP2RegionResolverWithSearchers(nil, nil), nil
	}

	searcher, closeFunc, err := buildIP2RegionSearcher(cfg)
	if err != nil {
		return nil, err
	}

	resolver := &ip2RegionResolver{close: closeFunc}
	if cfg.IPv4DBPath != "" {
		resolver.ipv4 = searcher
	}
	if cfg.IPv6DBPath != "" {
		resolver.ipv6 = searcher
	}
	return resolver, nil
}

func newIP2RegionResolverWithSearchers(ipv4 ip2RegionSearcher, ipv6 ip2RegionSearcher) Resolver {
	return &ip2RegionResolver{ipv4: ipv4, ipv6: ipv6}
}

func buildIP2RegionServiceSearcher(cfg config.Ip2RegionConfig) (ip2RegionSearcher, func(), error) {
	cachePolicy, err := ip2regionservice.CachePolicyFromName(cfg.CachePolicy)
	if err != nil {
		return nil, nil, err
	}

	var v4Config *ip2regionservice.Config
	if cfg.IPv4DBPath != "" {
		v4Config, err = ip2regionservice.NewV4Config(cachePolicy, cfg.IPv4DBPath, cfg.Searchers)
		if err != nil {
			return nil, nil, fmt.Errorf("create IPv4 ip2region config: %w", err)
		}
	}

	var v6Config *ip2regionservice.Config
	if cfg.IPv6DBPath != "" {
		v6Config, err = ip2regionservice.NewV6Config(cachePolicy, cfg.IPv6DBPath, cfg.Searchers)
		if err != nil {
			return nil, nil, fmt.Errorf("create IPv6 ip2region config: %w", err)
		}
	}

	service, err := ip2regionservice.NewIp2Region(v4Config, v6Config)
	if err != nil {
		return nil, nil, err
	}
	searcher := &ip2RegionServiceSearcher{service: service}
	return searcher, service.Close, nil
}

func (s *ip2RegionServiceSearcher) Search(ip string) (string, error) {
	if s == nil || s.service == nil {
		return "", nil
	}
	return s.service.Search(ip)
}

func (r *ip2RegionResolver) Resolve(_ context.Context, addr netip.Addr) (Region, bool, error) {
	if r == nil || !addr.IsValid() {
		return Region{}, false, nil
	}
	addr = addr.Unmap()
	searcher := r.ipv4
	if addr.Is6() && !addr.Is4In6() {
		searcher = r.ipv6
	}
	if searcher == nil {
		return Region{}, false, nil
	}
	raw, err := searcher.Search(addr.String())
	if err != nil {
		return Region{}, false, err
	}
	region, ok := parseIP2RegionLocation(raw)
	return region, ok, nil
}

func (r *ip2RegionResolver) Close() {
	if r != nil && r.close != nil {
		r.close()
	}
}

func parseIP2RegionLocation(raw string) (Region, bool) {
	parts := strings.Split(strings.TrimSpace(raw), "|")
	if len(parts) == 0 || strings.TrimSpace(parts[0]) == "" {
		return Region{}, false
	}
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "0" {
			continue
		}
		values = append(values, part)
	}
	if len(values) == 0 {
		return Region{}, false
	}
	if strings.EqualFold(values[0], "reserved") {
		return Region{}, false
	}
	region := Region{Country: values[0], Provider: "ip2region"}
	local := values[1:]
	if len(local) > 0 && isCountryCode(local[len(local)-1]) {
		local = local[:len(local)-1]
	}
	if len(local) > 0 {
		region.Province = local[0]
	}
	if len(local) > 1 {
		region.City = local[1]
	}
	if len(local) > 2 {
		region.ISP = local[2]
	}
	return normalizeRegion(region), true
}

func isCountryCode(value string) bool {
	if len(value) != 2 {
		return false
	}
	for _, r := range value {
		if !unicode.IsUpper(r) {
			return false
		}
	}
	return true
}
