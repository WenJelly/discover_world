package auth

import "testing"

func TestClaimToInt64RejectsFractionalFloatUserID(t *testing.T) {
	if _, err := claimToInt64(12.5); err == nil {
		t.Fatal("claimToInt64 accepted a fractional userId")
	}
}

func TestClaimToInt64RejectsZeroUnsignedUserID(t *testing.T) {
	if _, err := claimToInt64(uint64(0)); err == nil {
		t.Fatal("claimToInt64 accepted a zero userId")
	}
}

func TestClaimToInt64AcceptsPositiveIntegerClaims(t *testing.T) {
	got, err := claimToInt64(float64(12))
	if err != nil {
		t.Fatalf("claimToInt64 returned error: %v", err)
	}
	if got != 12 {
		t.Fatalf("claimToInt64 = %d, want 12", got)
	}
}
