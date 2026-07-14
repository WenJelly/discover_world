package account

import (
	"net/http"

	"discover_world/internal/logic/account"
	"discover_world/internal/svc"

	"github.com/zeromicro/go-zero/rest/httpx"
)

func LogoutAccountHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		logic := account.NewLogoutAccountLogic(r.Context(), svcCtx)
		if err := logic.LogoutAccount(r.Header.Get("Authorization")); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}
		httpx.OkJsonCtx(r.Context(), w, map[string]bool{"success": true})
	}
}
