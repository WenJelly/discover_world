package model

import "github.com/zeromicro/go-zero/core/stores/sqlx"

var _ MediaVariantRuleModel = (*customMediaVariantRuleModel)(nil)

type (
	// MediaVariantRuleModel is an interface to be customized, add more methods here,
	// and implement the added methods in customMediaVariantRuleModel.
	MediaVariantRuleModel interface {
		mediaVariantRuleModel
		withSession(session sqlx.Session) MediaVariantRuleModel
	}

	customMediaVariantRuleModel struct {
		*defaultMediaVariantRuleModel
	}
)

// NewMediaVariantRuleModel returns a model for the database table.
func NewMediaVariantRuleModel(conn sqlx.SqlConn) MediaVariantRuleModel {
	return &customMediaVariantRuleModel{
		defaultMediaVariantRuleModel: newMediaVariantRuleModel(conn),
	}
}

func (m *customMediaVariantRuleModel) withSession(session sqlx.Session) MediaVariantRuleModel {
	return NewMediaVariantRuleModel(sqlx.NewSqlConnFromSession(session))
}
