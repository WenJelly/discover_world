package statistics

import (
	"context"
	"discover_world/model/internal/modelutil"
	"errors"
	"fmt"
	"strings"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ EntityStatModel = (*customEntityStatModel)(nil)

type (
	// EntityStatModel is an interface to be customized, add more methods here,
	// and implement the added methods in customEntityStatModel.
	EntityStatModel interface {
		entityStatModel
		Ensure(ctx context.Context, targetType string, targetID uint64) error
		FindByTargetIDs(ctx context.Context, targetType string, targetIDs []uint64) (map[uint64]*EntityStat, error)
		IncrementCounter(ctx context.Context, targetType string, targetID uint64, counter string, delta int64) error
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

func (m *customEntityStatModel) Ensure(ctx context.Context, targetType string, targetID uint64) error {
	query := fmt.Sprintf("insert into %s (`target_type`,`target_id`) values (?, ?) on duplicate key update `target_id` = `target_id`", m.table)
	_, err := m.conn.ExecCtx(ctx, query, targetType, targetID)
	return err
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

	query := fmt.Sprintf("select %s from %s where `target_type` = ? and `target_id` in (%s)", entityStatRows, m.table, modelutil.InPlaceholders(len(args)-1))
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

func (m *customEntityStatModel) IncrementCounter(ctx context.Context, targetType string, targetID uint64, counter string, delta int64) error {
	if delta == 0 {
		return nil
	}

	counter, err := normalizeEntityStatCounter(counter)
	if err != nil {
		return err
	}
	if err := m.Ensure(ctx, targetType, targetID); err != nil {
		return err
	}

	if delta > 0 {
		query := fmt.Sprintf("update %s set `%s` = `%s` + ? where `target_type` = ? and `target_id` = ?", m.table, counter, counter)
		_, err = m.conn.ExecCtx(ctx, query, delta, targetType, targetID)
		return err
	}

	amount := -delta
	query := fmt.Sprintf("update %s set `%s` = case when `%s` >= ? then `%s` - ? else 0 end where `target_type` = ? and `target_id` = ?", m.table, counter, counter, counter)
	_, err = m.conn.ExecCtx(ctx, query, amount, amount, targetType, targetID)
	return err
}

func normalizeEntityStatCounter(counter string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(counter)) {
	case "view_count":
		return "view_count", nil
	case "reaction_count":
		return "reaction_count", nil
	case "favorite_count":
		return "favorite_count", nil
	case "comment_count":
		return "comment_count", nil
	case "share_count":
		return "share_count", nil
	case "download_count":
		return "download_count", nil
	default:
		return "", fmt.Errorf("unsupported entity stat counter: %s", counter)
	}
}
