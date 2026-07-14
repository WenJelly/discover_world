// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"net/http"

	"discover_world/internal/logic/account"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"github.com/zeromicro/go-zero/rest/httpx"
)

func SetAccountAvatarHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.SetAccountAvatarRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}

		l := account.NewSetAccountAvatarLogic(r.Context(), svcCtx)
		resp, err := l.SetAccountAvatar(&req)
		if err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, resp)
		}
	}
}
