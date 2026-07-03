package model

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ CommentRecordModel = (*customCommentRecordModel)(nil)

type (
	// CommentRecordModel is an interface to be customized, add more methods here,
	// and implement the added methods in customCommentRecordModel.
	CommentRecordModel interface {
		commentRecordModel
		withSession(session sqlx.Session) CommentRecordModel
	}

	customCommentRecordModel struct {
		*defaultCommentRecordModel
	}
)

// NewCommentRecordModel returns a model for the database table.
func NewCommentRecordModel(conn sqlx.SqlConn) CommentRecordModel {
	return &customCommentRecordModel{
		defaultCommentRecordModel: newCommentRecordModel(conn),
	}
}

func (m *customCommentRecordModel) withSession(session sqlx.Session) CommentRecordModel {
	return NewCommentRecordModel(sqlx.NewSqlConnFromSession(session))
}
