package svc

import (
	postmodel "discover_world/model/post"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

type PostModels struct {
	Post           postmodel.PostModel
	PostDiscussion postmodel.PostDiscussionModel
	CommentRecord  postmodel.CommentRecordModel
}

func newPostModels(conn sqlx.SqlConn) PostModels {
	return PostModels{
		Post:           postmodel.NewPostModel(conn),
		PostDiscussion: postmodel.NewPostDiscussionModel(conn),
		CommentRecord:  postmodel.NewCommentRecordModel(conn),
	}
}
