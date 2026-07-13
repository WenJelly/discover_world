package ipgeo

import (
	"context"
	"errors"
	"net/netip"
	"testing"

	"discover_world/internal/config"
)

type stubIP2RegionSearcher struct {
	result string
	err    error
	calls  int
}

func (s *stubIP2RegionSearcher) Search(ip string) (string, error) {
	s.calls++
	if s.err != nil {
		return "", s.err
	}
	return s.result, nil
}

func TestStaticResolverMatchesConfiguredCIDR(t *testing.T) {
	resolver := NewStaticResolver([]StaticRule{
		{
			CIDR:            "8.8.8.0/24",
			Country:         "美国",
			Province:        "加利福尼亚",
			City:            "山景城",
			DisplayLocation: "美国 · 加利福尼亚",
			Provider:        "static",
		},
	})

	region, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("8.8.8.8"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected configured CIDR to resolve")
	}
	if region.DisplayLocation != "美国 · 加利福尼亚" {
		t.Fatalf("display location = %q", region.DisplayLocation)
	}
	if region.Provider != "static" {
		t.Fatalf("provider = %q", region.Provider)
	}
}

func TestHashIPUsesHMACAndDoesNotExposeRawIP(t *testing.T) {
	hash := HashIP(netip.MustParseAddr("8.8.8.8"), "secret")
	if hash == "" {
		t.Fatal("expected non-empty hash")
	}
	if hash == "8.8.8.8" {
		t.Fatal("hash must not expose raw IP")
	}
	if hash != HashIP(netip.MustParseAddr("8.8.8.8"), "secret") {
		t.Fatal("hash should be stable for the same IP and secret")
	}
	if hash == HashIP(netip.MustParseAddr("8.8.4.4"), "secret") {
		t.Fatal("different IPs should not share the same hash")
	}
}

func TestIP2RegionResolverMapsXDBLocation(t *testing.T) {
	searcher := &stubIP2RegionSearcher{
		result: "中国|上海|上海市|电信|CN",
	}
	resolver := newIP2RegionResolverWithSearchers(searcher, nil)

	region, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("1.2.3.4"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected ip2region result to resolve")
	}
	if searcher.calls != 1 {
		t.Fatalf("searcher calls = %d, want 1", searcher.calls)
	}
	if region.Country != "中国" || region.Province != "上海" || region.City != "上海市" || region.ISP != "电信" {
		t.Fatalf("unexpected region: %+v", region)
	}
	if region.DisplayLocation != "中国 · 上海市" {
		t.Fatalf("display location = %q", region.DisplayLocation)
	}
	if region.Provider != "ip2region" {
		t.Fatalf("provider = %q", region.Provider)
	}
}

func TestIP2RegionResolverTreatsReservedLocationAsUnresolved(t *testing.T) {
	searcher := &stubIP2RegionSearcher{
		result: "Reserved|0|0|0|0",
	}
	resolver := newIP2RegionResolverWithSearchers(searcher, nil)

	region, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("127.0.0.1"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if ok {
		t.Fatalf("reserved location should not resolve: %+v", region)
	}
	if region != (Region{}) {
		t.Fatalf("reserved location should return an empty region: %+v", region)
	}
}

func TestIP2RegionResolverUsesIPv6Searcher(t *testing.T) {
	ipv4 := &stubIP2RegionSearcher{result: "中国|0|北京|北京市|联通"}
	ipv6 := &stubIP2RegionSearcher{result: "中国|广东省|广州市|移动|CN"}
	resolver := newIP2RegionResolverWithSearchers(ipv4, ipv6)

	region, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("240e:abcd::1"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected IPv6 ip2region result to resolve")
	}
	if ipv4.calls != 0 {
		t.Fatalf("IPv4 searcher calls = %d, want 0", ipv4.calls)
	}
	if ipv6.calls != 1 {
		t.Fatalf("IPv6 searcher calls = %d, want 1", ipv6.calls)
	}
	if region.DisplayLocation != "中国 · 广州市" {
		t.Fatalf("display location = %q", region.DisplayLocation)
	}
}

func TestIP2RegionResolverPropagatesSearchError(t *testing.T) {
	searcher := &stubIP2RegionSearcher{err: errors.New("xdb broken")}
	resolver := newIP2RegionResolverWithSearchers(searcher, nil)

	_, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("1.2.3.4"))
	if err == nil {
		t.Fatal("expected search error")
	}
	if ok {
		t.Fatal("errored lookup should not resolve")
	}
}

func TestNewIP2RegionResolverWithEmptyPathDisablesLookup(t *testing.T) {
	resolver, err := NewIP2RegionResolver(config.Ip2RegionConfig{})
	if err != nil {
		t.Fatalf("empty ip2region config should disable lookup without error: %v", err)
	}

	_, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("1.2.3.4"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if ok {
		t.Fatal("empty ip2region config should not resolve")
	}
}

func TestNewIP2RegionResolverBuildsConfiguredSearcher(t *testing.T) {
	previous := buildIP2RegionSearcher
	t.Cleanup(func() {
		buildIP2RegionSearcher = previous
	})

	searcher := &stubIP2RegionSearcher{result: "中国|浙江省|杭州市|电信|CN"}
	var got config.Ip2RegionConfig
	closed := false
	buildIP2RegionSearcher = func(cfg config.Ip2RegionConfig) (ip2RegionSearcher, func(), error) {
		got = cfg
		return searcher, func() { closed = true }, nil
	}

	resolver, err := NewIP2RegionResolver(config.Ip2RegionConfig{
		DBPath:      " /data/ip2region_v4.xdb ",
		IPv6DBPath:  " /data/ip2region_v6.xdb ",
		CachePolicy: "content",
		Searchers:   3,
	})
	if err != nil {
		t.Fatalf("NewIP2RegionResolver returned error: %v", err)
	}

	region, ok, err := resolver.Resolve(context.Background(), netip.MustParseAddr("1.2.3.4"))
	if err != nil {
		t.Fatalf("resolve returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected configured ip2region resolver to resolve")
	}
	if region.DisplayLocation != "中国 · 杭州市" {
		t.Fatalf("display location = %q", region.DisplayLocation)
	}
	if got.IPv4DBPath != "/data/ip2region_v4.xdb" || got.IPv6DBPath != "/data/ip2region_v6.xdb" {
		t.Fatalf("unexpected normalized paths: %+v", got)
	}
	if got.CachePolicy != "content" || got.Searchers != 3 {
		t.Fatalf("unexpected config: %+v", got)
	}

	if closer, ok := resolver.(interface{ Close() }); ok {
		closer.Close()
	}
	if !closed {
		t.Fatal("resolver close should close ip2region searcher")
	}
}
