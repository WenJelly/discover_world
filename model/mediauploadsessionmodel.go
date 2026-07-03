package model

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ MediaUploadSessionModel = (*customMediaUploadSessionModel)(nil)

type (
	// MediaUploadSessionModel is an interface to be customized, add more methods here,
	// and implement the added methods in customMediaUploadSessionModel.
	MediaUploadSessionModel interface {
		mediaUploadSessionModel
		withSession(session sqlx.Session) MediaUploadSessionModel
	}

	customMediaUploadSessionModel struct {
		*defaultMediaUploadSessionModel
	}
)

// NewMediaUploadSessionModel returns a model for the database table.
func NewMediaUploadSessionModel(conn sqlx.SqlConn) MediaUploadSessionModel {
	return &customMediaUploadSessionModel{
		defaultMediaUploadSessionModel: newMediaUploadSessionModel(conn),
	}
}

func (m *customMediaUploadSessionModel) withSession(session sqlx.Session) MediaUploadSessionModel {
	return NewMediaUploadSessionModel(sqlx.NewSqlConnFromSession(session))
}
