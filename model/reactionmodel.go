package model

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ ReactionModel = (*customReactionModel)(nil)

type (
	// ReactionModel is an interface to be customized, add more methods here,
	// and implement the added methods in customReactionModel.
	ReactionModel interface {
		reactionModel
		withSession(session sqlx.Session) ReactionModel
	}

	customReactionModel struct {
		*defaultReactionModel
	}
)

// NewReactionModel returns a model for the database table.
func NewReactionModel(conn sqlx.SqlConn) ReactionModel {
	return &customReactionModel{
		defaultReactionModel: newReactionModel(conn),
	}
}

func (m *customReactionModel) withSession(session sqlx.Session) ReactionModel {
	return NewReactionModel(sqlx.NewSqlConnFromSession(session))
}
