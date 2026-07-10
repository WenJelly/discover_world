package admin

import (
	"net/http"

	logic "discover_world/internal/logic/admin"
	"discover_world/internal/svc"
	"discover_world/internal/types"

	"github.com/zeromicro/go-zero/rest/httpx"
)

func UnfeatureAdminContentHandler(svcCtx *svc.ServiceContext) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req types.AdminFeatureContentRequest
		if err := httpx.Parse(r, &req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
			return
		}
		l := logic.NewUnfeatureAdminContentLogic(r.Context(), svcCtx)
		if err := l.UnfeatureAdminContent(&req); err != nil {
			httpx.ErrorCtx(r.Context(), w, err)
		} else {
			httpx.OkJsonCtx(r.Context(), w, map[string]bool{"success": true})
		}
	}
}
