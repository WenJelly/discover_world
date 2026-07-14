package svc

import (
	searchmodel "discover_world/model/search"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type SearchModels struct {
	Search searchmodel.SearchModel
}

func newSearchModels(conn sqlx.SqlConn) SearchModels {
	return SearchModels{Search: searchmodel.NewSearchModel(conn)}
}
