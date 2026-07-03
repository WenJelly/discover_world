// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package middleware

import (
	"net/http"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
)

type AdminCheckMiddleware struct {
	provider commonauth.AccountProvider
}

func NewAdminCheckMiddleware(provider commonauth.AccountProvider) *AdminCheckMiddleware {
	return &AdminCheckMiddleware{
		provider: provider,
	}
}

func (m *AdminCheckMiddleware) Handle(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		loginUser, err := commonauth.LoadRequiredAdminUser(r.Context(), m.provider, r.Header.Get("Authorization"))
		if err != nil {
			commonresponse.Response(w, nil, err)
			return
		}

		next(w, r.WithContext(commonauth.WithLoginUser(r.Context(), loginUser)))
	}
}
