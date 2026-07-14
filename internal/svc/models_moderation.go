package svc

import (
	moderationmodel "discover_world/model/moderation"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type ModerationModels struct {
	ModerationReport     moderationmodel.ModerationReportModel
	ContentIpAttribution moderationmodel.ContentIpAttributionModel
}

func newModerationModels(conn sqlx.SqlConn) ModerationModels {
	return ModerationModels{
		ModerationReport:     moderationmodel.NewModerationReportModel(conn),
		ContentIpAttribution: moderationmodel.NewContentIpAttributionModel(conn),
	}
}
