package svc

import (
	followmodel "discover_world/model/follow"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type FollowModels struct {
	UserFollow followmodel.UserFollowModel
}

func newFollowModels(conn sqlx.SqlConn) FollowModels {
	return FollowModels{UserFollow: followmodel.NewUserFollowModel(conn)}
}
