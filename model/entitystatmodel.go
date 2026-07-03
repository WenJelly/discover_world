package model

import (
	"context"
	"errors"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ EntityStatModel = (*customEntityStatModel)(nil)

type (
	// EntityStatModel is an interface to be customized, add more methods here,
	// and implement the added methods in customEntityStatModel.
	EntityStatModel interface {
		entityStatModel
		FindByTargetIDs(ctx context.Context, targetType string, targetIDs []uint64) (map[uint64]*EntityStat, error)
		IncrementViewCount(ctx context.Context, targetType string, targetID uint64) error
		withSession(session sqlx.Session) EntityStatModel
	}

	customEntityStatModel struct {
		*defaultEntityStatModel
	}
)

// NewEntityStatModel returns a model for the database table.
func NewEntityStatModel(conn sqlx.SqlConn) EntityStatModel {
	return &customEntityStatModel{
		defaultEntityStatModel: newEntityStatModel(conn),
	}
}

func (m *customEntityStatModel) withSession(session sqlx.Session) EntityStatModel {
	return NewEntityStatModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customEntityStatModel) FindByTargetIDs(ctx context.Context, targetType string, targetIDs []uint64) (map[uint64]*EntityStat, error) {
	resp := make(map[uint64]*EntityStat)
	if len(targetIDs) == 0 {
		return resp, nil
	}

	args := []any{targetType}
	for _, id := range targetIDs {
		if id > 0 {
			args = append(args, id)
		}
	}
	if len(args) == 1 {
		return resp, nil
	}

	query := fmt.Sprintf("select %s from %s where `target_type` = ? and `target_id` in (%s)", entityStatRows, m.table, inPlaceholders(len(args)-1))
	var rows []*EntityStat
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.TargetId] = row
		}
	}
	return resp, nil
}

func (m *customEntityStatModel) IncrementViewCount(ctx context.Context, targetType string, targetID uint64) error {
	stat, err := m.FindOneByTargetTypeTargetId(ctx, targetType, targetID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			_, insertErr := m.Insert(ctx, &EntityStat{
				TargetType: targetType,
				TargetId:   targetID,
				ViewCount:  1,
			})
			return insertErr
		}
		return err
	}

	query := fmt.Sprintf("update %s set `view_count` = `view_count` + 1 where `id` = ?", m.table)
	_, err = m.conn.ExecCtx(ctx, query, stat.Id)
	return err
}
