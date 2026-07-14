package media

import (
	"errors"
	"testing"
)

func TestCOSMetricResultCode(t *testing.T) {
	if got := cosMetricResultCode(200, nil); got != "200" {
		t.Fatalf("success result code = %q, want 200", got)
	}
	if got := cosMetricResultCode(0, errors.New("dial failed")); got != "transport_error" {
		t.Fatalf("transport result code = %q, want transport_error", got)
	}
	if got := cosMetricResultCode(0, nil); got != "unknown" {
		t.Fatalf("unknown result code = %q, want unknown", got)
	}
}
