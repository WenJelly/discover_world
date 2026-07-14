package svc

import (
	forummodel "discover_world/model/forum"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type ForumModels struct {
	ForumBoard forummodel.ForumBoardModel
}

func newForumModels(conn sqlx.SqlConn) ForumModels {
	return ForumModels{ForumBoard: forummodel.NewForumBoardModel(conn)}
}
