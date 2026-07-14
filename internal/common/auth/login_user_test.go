package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

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

func TestExtractTokenMetadataFromBearerToken(t *testing.T) {
	expiresAt := time.Now().Add(time.Hour).Truncate(time.Second)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": "12",
		"jti":    "session-123",
		"exp":    expiresAt.Unix(),
	})
	signed, err := token.SignedString([]byte("secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	metadata, err := ExtractTokenMetadataFromBearerToken("Bearer "+signed, "secret")
	if err != nil {
		t.Fatalf("ExtractTokenMetadataFromBearerToken: %v", err)
	}
	if metadata.ID != "session-123" || !metadata.ExpiresAt.Equal(expiresAt) {
		t.Fatalf("metadata = %#v", metadata)
	}
}

func TestExtractTokenMetadataRejectsTokenWithoutJTI(t *testing.T) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": "12",
		"exp":    time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte("secret"))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	if _, err := ExtractTokenMetadataFromBearerToken("Bearer "+signed, "secret"); err == nil {
		t.Fatal("token without jti was accepted")
	}
}
