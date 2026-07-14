package taxonomy

import (
	"context"
	"discover_world/model/internal/modelutil"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ TaggingModel = (*customTaggingModel)(nil)

type (
	// TaggingModel is an interface to be customized, add more methods here,
	// and implement the added methods in customTaggingModel.
	TaggingModel interface {
		taggingModel
		FindNamesByTargetIDs(ctx context.Context, targetType string, targetIDs []uint64) (map[uint64][]string, error)
		MoveTaggings(ctx context.Context, sourceTagID uint64, targetTagID uint64) error
		ReplaceTargetTags(ctx context.Context, targetType string, targetID uint64, tagIDs []uint64) error
		withSession(session sqlx.Session) TaggingModel
	}

	customTaggingModel struct {
		*defaultTaggingModel
	}
)

// NewTaggingModel returns a model for the database table.
func NewTaggingModel(conn sqlx.SqlConn) TaggingModel {
	return &customTaggingModel{
		defaultTaggingModel: newTaggingModel(conn),
	}
}

func (m *customTaggingModel) MoveTaggings(ctx context.Context, sourceTagID uint64, targetTagID uint64) error {
	if sourceTagID == 0 || targetTagID == 0 || sourceTagID == targetTagID {
		return nil
	}
	deleteDupQuery := fmt.Sprintf("delete src from %s src where src.`tag_id` = ? and exists (select 1 from %s dst where dst.`tag_id` = ? and dst.`target_type` = src.`target_type` and dst.`target_id` = src.`target_id`)", m.table, m.table)
	if _, err := m.conn.ExecCtx(ctx, deleteDupQuery, sourceTagID, targetTagID); err != nil {
		return err
	}
	updateQuery := fmt.Sprintf("update %s set `tag_id` = ? where `tag_id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, updateQuery, targetTagID, sourceTagID)
	return err
}

func (m *customTaggingModel) withSession(session sqlx.Session) TaggingModel {
	return NewTaggingModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customTaggingModel) FindNamesByTargetIDs(ctx context.Context, targetType string, targetIDs []uint64) (map[uint64][]string, error) {
	resp := make(map[uint64][]string)
	targetIDs = modelutil.UniquePositiveIDs(targetIDs)
	if len(targetIDs) == 0 {
		return resp, nil
	}

	args := []any{targetType}
	for _, id := range targetIDs {
		args = append(args, id)
	}

	var rows []struct {
		TargetId uint64 `db:"target_id"`
		Name     string `db:"name"`
	}
	query := fmt.Sprintf(
		"select tg.`target_id`, t.`name` from %s tg join `tag` t on t.`id` = tg.`tag_id` where tg.`target_type` = ? and tg.`target_id` in (%s) and t.`status` = 1 order by tg.`id` asc",
		m.table,
		modelutil.InPlaceholders(len(args)-1),
	)
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		resp[row.TargetId] = append(resp[row.TargetId], row.Name)
	}
	return resp, nil
}

func (m *customTaggingModel) ReplaceTargetTags(ctx context.Context, targetType string, targetID uint64, tagIDs []uint64) error {
	deleteQuery := fmt.Sprintf("delete from %s where `target_type` = ? and `target_id` = ?", m.table)
	if _, err := m.conn.ExecCtx(ctx, deleteQuery, targetType, targetID); err != nil {
		return err
	}

	insertQuery := fmt.Sprintf("insert into %s (`tag_id`, `target_type`, `target_id`, `source`) values (?, ?, ?, 'user')", m.table)
	for _, tagID := range tagIDs {
		if tagID == 0 {
			continue
		}
		if _, err := m.conn.ExecCtx(ctx, insertQuery, tagID, targetType, targetID); err != nil {
			return err
		}
	}
	return nil
}
