package model

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
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
		FindByFilter(ctx context.Context, filter TagFilter, pageNum int64, pageSize int64) ([]*Tag, error)
		CountByFilter(ctx context.Context, filter TagFilter) (int64, error)
		withSession(session sqlx.Session) TagModel
	}

	customTagModel struct {
		*defaultTagModel
	}

	TagFilter struct {
		Name    string
		TagType string
		Status  int64
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

func (m *customTagModel) FindByFilter(ctx context.Context, filter TagFilter, pageNum int64, pageSize int64) ([]*Tag, error) {
	whereSQL, args := buildTagWhere(filter)
	if pageNum <= 0 {
		pageNum = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ? offset ?", tagRows, m.table, whereSQL)
	args = append(args, pageSize, (pageNum-1)*pageSize)

	var resp []*Tag
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customTagModel) CountByFilter(ctx context.Context, filter TagFilter) (int64, error) {
	whereSQL, args := buildTagWhere(filter)
	query := fmt.Sprintf("select count(1) from %s where %s", m.table, whereSQL)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, args...); err != nil {
		return 0, err
	}
	return resp, nil
}

func buildTagWhere(filter TagFilter) (string, []any) {
	conditions := []string{"1 = 1"}
	args := make([]any, 0)
	if value := strings.TrimSpace(filter.Name); value != "" {
		conditions = append(conditions, "`name` like ?")
		args = append(args, "%"+value+"%")
	}
	if value := strings.TrimSpace(filter.TagType); value != "" {
		conditions = append(conditions, "`tag_type` = ?")
		args = append(args, value)
	}
	if filter.Status == 0 || filter.Status == 1 {
		conditions = append(conditions, "`status` = ?")
		args = append(args, filter.Status)
	}
	return strings.Join(conditions, " and "), args
}
