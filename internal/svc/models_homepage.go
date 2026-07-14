package svc

import (
	homepagemodel "discover_world/model/homepage"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type HomepageModels struct {
	SiteConfig homepagemodel.SiteConfigModel
}

func newHomepageModels(conn sqlx.SqlConn) HomepageModels {
	return HomepageModels{SiteConfig: homepagemodel.NewSiteConfigModel(conn)}
}
