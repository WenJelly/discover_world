package middleware

import (
	"context"
	"net/http"
	"strings"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"

	"github.com/zeromicro/go-zero/core/logx"
	"github.com/zeromicro/go-zero/rest/httpx"
)

type tokenRevocationChecker interface {
	IsTokenRevoked(ctx context.Context, tokenID string) (bool, error)
}

type TokenRevocationMiddleware struct {
	checker tokenRevocationChecker
	secret  string
}

func NewTokenRevocationMiddleware(checker tokenRevocationChecker, secret string) *TokenRevocationMiddleware {
	return &TokenRevocationMiddleware{checker: checker, secret: secret}
}

func (m *TokenRevocationMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if m == nil || m.checker == nil || strings.TrimSpace(r.Header.Get("Authorization")) == "" {
			next(w, r)
			return
		}
		metadata, err := commonauth.ExtractTokenMetadataFromBearerToken(r.Header.Get("Authorization"), m.secret)
		if err != nil {
			next(w, r)
			return
		}
		revoked, err := m.checker.IsTokenRevoked(r.Context(), metadata.ID)
		if err != nil {
			logx.WithContext(r.Context()).Errorf("redis token revocation check failed closed: %v", err)
			writeMiddlewareError(r, w, commonresponse.InternalServerError("登录状态校验失败"))
			return
		}
		if revoked {
			writeMiddlewareError(r, w, commonresponse.Unauthorized("登录已失效，请重新登录"))
			return
		}
		next(w, r)
	}
}

func writeMiddlewareError(r *http.Request, w http.ResponseWriter, err error) {
	statusCode, body := commonresponse.ErrorBody(err)
	httpx.WriteJsonCtx(r.Context(), w, statusCode, body)
}
