package svc

import (
	profilemodel "discover_world/model/profile"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type ProfileModels struct {
	UserProfile profilemodel.UserProfileModel
	Album       profilemodel.AlbumModel
}

func newProfileModels(conn sqlx.SqlConn) ProfileModels {
	return ProfileModels{
		UserProfile: profilemodel.NewUserProfileModel(conn),
		Album:       profilemodel.NewAlbumModel(conn),
	}
}
