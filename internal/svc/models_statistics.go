package svc

import (
	statisticsmodel "discover_world/model/statistics"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type StatisticsModels struct {
	EntityStat       statisticsmodel.EntityStatModel
	EntityStatHourly statisticsmodel.EntityStatHourlyModel
	EntityRanking    statisticsmodel.EntityRankingModel
	SiteStats        statisticsmodel.SiteStatsModel
}

func newStatisticsModels(conn sqlx.SqlConn) StatisticsModels {
	return StatisticsModels{
		EntityStat:       statisticsmodel.NewEntityStatModel(conn),
		EntityStatHourly: statisticsmodel.NewEntityStatHourlyModel(conn),
		EntityRanking:    statisticsmodel.NewEntityRankingModel(conn),
		SiteStats:        statisticsmodel.NewSiteStatsModel(conn),
	}
}
