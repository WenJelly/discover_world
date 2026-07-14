package svc

import (
	interactionmodel "discover_world/model/interaction"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type InteractionModels struct {
	Reaction interactionmodel.ReactionModel
	Favorite interactionmodel.FavoriteModel
}

func newInteractionModels(conn sqlx.SqlConn) InteractionModels {
	return InteractionModels{
		Reaction: interactionmodel.NewReactionModel(conn),
		Favorite: interactionmodel.NewFavoriteModel(conn),
	}
}
