package ipgeo

import (
	"context"
	"net/netip"
	"testing"

	"discover_world/internal/common/clientip"
	commonipgeo "discover_world/internal/common/ipgeo"
)

func TestBuildAttributionRecordUsesClientIPSnapshot(t *testing.T) {
	ctx := clientip.WithClientIP(context.Background(), netip.MustParseAddr("8.8.8.8"))
	resolver := commonipgeo.NewStaticResolver([]commonipgeo.StaticRule{
		{
			CIDR:            "8.8.8.0/24",
			Country:         "美国",
			Province:        "加利福尼亚",
			City:            "山景城",
			DisplayLocation: "美国 · 加利福尼亚",
			Provider:        "static",
		},
	})

	record, ok, err := BuildAttributionRecord(ctx, resolver, "hash-secret", TargetTypePost, 42, ActionTypeCreate, 7)
	if err != nil {
		t.Fatalf("build attribution record returned error: %v", err)
	}
	if !ok {
		t.Fatal("expected attribution record")
	}
	if record.TargetType != TargetTypePost || record.TargetId != 42 || record.UserId != 7 {
		t.Fatalf("unexpected record target/user: %+v", record)
	}
	if record.DisplayLocation.String != "美国 · 加利福尼亚" {
		t.Fatalf("display location = %q", record.DisplayLocation.String)
	}
	if !record.IpHash.Valid || record.IpHash.String == "8.8.8.8" {
		t.Fatalf("ip hash should be present and redacted: %+v", record.IpHash)
	}
}
