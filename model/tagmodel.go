package model

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ TagModel = (*customTagModel)(nil)

type (
	// TagModel is an interface to be customized, add more methods here,
	// and implement the added methods in customTagModel.
	TagModel interface {
		tagModel
		EnsureByName(ctx context.Context, name string) (*Tag, error)
		withSession(session sqlx.Session) TagModel
	}

	customTagModel struct {
		*defaultTagModel
	}
)

// NewTagModel returns a model for the database table.
func NewTagModel(conn sqlx.SqlConn) TagModel {
	return &customTagModel{
		defaultTagModel: newTagModel(conn),
	}
}

func (m *customTagModel) withSession(session sqlx.Session) TagModel {
	return NewTagModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customTagModel) EnsureByName(ctx context.Context, name string) (*Tag, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNotFound
	}

	existing, err := m.FindOneByName(ctx, name)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	_, err = m.Insert(ctx, &Tag{
		Name:    name,
		Slug:    sql.NullString{String: strings.ToLower(name), Valid: true},
		TagType: "normal",
		Status:  1,
	})
	if err != nil {
		existing, findErr := m.FindOneByName(ctx, name)
		if findErr == nil {
			return existing, nil
		}
		return nil, err
	}

	return m.FindOneByName(ctx, name)
}
