package search

import (
	"errors"
	"testing"
)

func TestSearchMetricResult(t *testing.T) {
	if got := searchMetricResult(nil); got != "success" {
		t.Fatalf("success metric result = %q, want success", got)
	}
	if got := searchMetricResult(errors.New("query failed")); got != "error" {
		t.Fatalf("error metric result = %q, want error", got)
	}
}
