package auth

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"strconv"
	"strings"
	"time"

	commonresponse "discover_world/internal/common/response"
	"discover_world/model"

	"github.com/golang-jwt/jwt/v4"
)

type AccountProvider interface {
	AuthSecret() string
	FindActiveAccount(ctx context.Context, id uint64) (*model.UserAccount, error)
	IsAdminAccount(account *model.UserAccount) bool
}

type TokenMetadata struct {
	ID        string
	ExpiresAt time.Time
}

func ExtractTokenMetadataFromBearerToken(authorization, secret string) (TokenMetadata, error) {
	claims, err := parseBearerTokenClaims(authorization, secret)
	if err != nil {
		return TokenMetadata{}, err
	}
	tokenID, _ := claims["jti"].(string)
	tokenID = strings.TrimSpace(tokenID)
	if tokenID == "" {
		return TokenMetadata{}, errors.New("missing jti claim")
	}
	expiresAt, err := claimToUnixTime(claims["exp"])
	if err != nil {
		return TokenMetadata{}, err
	}
	return TokenMetadata{ID: tokenID, ExpiresAt: expiresAt}, nil
}

func ExtractUserIDFromBearerToken(authorization, secret string) (uint64, error) {
	claims, err := parseBearerTokenClaims(authorization, secret)
	if err != nil {
		return 0, err
	}
	return claimToInt64(claims["userId"])
}

func parseBearerTokenClaims(authorization, secret string) (jwt.MapClaims, error) {
	if strings.TrimSpace(secret) == "" {
		return nil, errors.New("jwt secret is empty")
	}

	if authorization == "" {
		return nil, errors.New("missing authorization header")
	}

	parts := strings.SplitN(strings.TrimSpace(authorization), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
		return nil, errors.New("invalid authorization header")
	}

	token, err := jwt.Parse(parts[1], func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil || token == nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}
	return claims, nil
}

func claimToUnixTime(value any) (time.Time, error) {
	switch v := value.(type) {
	case float64:
		if v <= 0 || math.Trunc(v) != v {
			return time.Time{}, errors.New("invalid exp claim")
		}
		return time.Unix(int64(v), 0), nil
	case json.Number:
		seconds, err := v.Int64()
		if err != nil || seconds <= 0 {
			return time.Time{}, errors.New("invalid exp claim")
		}
		return time.Unix(seconds, 0), nil
	case int64:
		if v <= 0 {
			return time.Time{}, errors.New("invalid exp claim")
		}
		return time.Unix(v, 0), nil
	default:
		return time.Time{}, errors.New("invalid exp claim")
	}
}

func ExtractUserIDFromContext(ctx context.Context) (uint64, error) {
	if ctx == nil {
		return 0, errors.New("missing context")
	}

	for _, key := range []string{"userId", "uid", "id"} {
		if value := ctx.Value(key); value != nil {
			return claimToInt64(value)
		}
	}

	return 0, errors.New("missing userId claim")
}

func LoadRequiredLoginUser(ctx context.Context, provider AccountProvider, authorization string) (*model.UserAccount, error) {
	if loginUser, ok := LoginUserFromContext(ctx); ok {
		return loginUser, nil
	}

	userID, err := ExtractUserIDFromContext(ctx)
	if err != nil {
		userID, err = ExtractUserIDFromBearerToken(authorization, provider.AuthSecret())
	}
	if err != nil {
		return nil, commonresponse.Unauthorized("请先登录")
	}

	loginUser, err := provider.FindActiveAccount(ctx, userID)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.Unauthorized("登录用户不存在")
		}
		return nil, commonresponse.InternalServerError("查询登录用户失败")
	}

	return loginUser, nil
}

func LoadRequiredAdminUser(ctx context.Context, provider AccountProvider, authorization string) (*model.UserAccount, error) {
	loginUser, err := LoadRequiredLoginUser(ctx, provider, authorization)
	if err != nil {
		return nil, err
	}
	if !provider.IsAdminAccount(loginUser) {
		return nil, commonresponse.Forbidden("仅管理员可访问")
	}

	return loginUser, nil
}

func LoadOptionalLoginUser(ctx context.Context, provider AccountProvider, authorization string) (*model.UserAccount, error) {
	if strings.TrimSpace(authorization) == "" {
		if _, err := ExtractUserIDFromContext(ctx); err != nil {
			return nil, nil
		}
	}

	return LoadRequiredLoginUser(ctx, provider, authorization)
}

func claimToInt64(value any) (uint64, error) {
	switch v := value.(type) {
	case float64:
		return positiveIntegerClaimFromFloat(float64(v))
	case float32:
		return positiveIntegerClaimFromFloat(float64(v))
	case uint64:
		if v == 0 {
			return 0, errors.New("invalid userId claim")
		}
		return v, nil
	case uint:
		if v == 0 {
			return 0, errors.New("invalid userId claim")
		}
		return uint64(v), nil
	case int64:
		if v <= 0 {
			return 0, errors.New("invalid userId claim")
		}
		return uint64(v), nil
	case int32:
		if v <= 0 {
			return 0, errors.New("invalid userId claim")
		}
		return uint64(v), nil
	case int:
		if v <= 0 {
			return 0, errors.New("invalid userId claim")
		}
		return uint64(v), nil
	case json.Number:
		id, err := v.Int64()
		if err != nil || id <= 0 {
			return 0, errors.New("invalid userId claim")
		}
		return uint64(id), nil
	case string:
		id, err := strconv.ParseUint(v, 10, 64)
		if err != nil || id == 0 {
			return 0, errors.New("invalid userId claim")
		}
		return id, nil
	default:
		return 0, errors.New("invalid userId claim")
	}
}

func positiveIntegerClaimFromFloat(value float64) (uint64, error) {
	if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) || math.Trunc(value) != value {
		return 0, errors.New("invalid userId claim")
	}
	return uint64(value), nil
}
