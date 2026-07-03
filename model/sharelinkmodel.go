package model

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ ShareLinkModel = (*customShareLinkModel)(nil)

type (
	// ShareLinkModel is an interface to be customized, add more methods here,
	// and implement the added methods in customShareLinkModel.
	ShareLinkModel interface {
		shareLinkModel
		withSession(session sqlx.Session) ShareLinkModel
	}

	customShareLinkModel struct {
		*defaultShareLinkModel
	}
)

// NewShareLinkModel returns a model for the database table.
func NewShareLinkModel(conn sqlx.SqlConn) ShareLinkModel {
	return &customShareLinkModel{
		defaultShareLinkModel: newShareLinkModel(conn),
	}
}

func (m *customShareLinkModel) withSession(session sqlx.Session) ShareLinkModel {
	return NewShareLinkModel(sqlx.NewSqlConnFromSession(session))
}
