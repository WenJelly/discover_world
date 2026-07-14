package media

import (
	"context"
	"discover_world/model/internal/modelutil"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ MediaAssetModel = (*customMediaAssetModel)(nil)

type (
	// MediaAssetModel is an interface to be customized, add more methods here,
	// and implement the added methods in customMediaAssetModel.
	MediaAssetModel interface {
		mediaAssetModel
		FindOneActive(ctx context.Context, id uint64) (*MediaAsset, error)
		CountByWhere(ctx context.Context, whereSQL string, args ...any) (int64, error)
		FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*MediaAsset, error)
		FindPublicApprovedByIDs(ctx context.Context, ids []uint64) (map[uint64]*MediaAsset, error)
		FindOwnerPublicApprovedByIDs(ctx context.Context, ownerUserID uint64, ids []uint64) (map[uint64]*MediaAsset, error)
		CountPublicApprovedByOwner(ctx context.Context, ownerUserID uint64) (int64, error)
		FindPublicWorkByOwnersBeforeID(ctx context.Context, ownerIDs []uint64, beforeID uint64, limit int64) ([]*MediaAsset, error)
		FindByWhere(ctx context.Context, whereSQL, orderSQL string, limit, offset int64, args ...any) ([]*MediaAsset, error)
		FindByWhereBeforeID(ctx context.Context, whereSQL, orderSQL string, beforeID, limit int64, args ...any) ([]*MediaAsset, error)
		FindByWhereBeforeCreatedAt(ctx context.Context, whereSQL string, beforeCreatedAt time.Time, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error)
		FindByWhereBeforeHotScore(ctx context.Context, whereSQL string, beforeScore float64, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error)
		FindHotScoreByID(ctx context.Context, id uint64) (float64, error)
		FindByWhereBeforeRisingScore(ctx context.Context, whereSQL string, beforeScore float64, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error)
		FindRisingScoreByID(ctx context.Context, id uint64) (float64, error)
		CountStatsByOwner(ctx context.Context, ownerUserID uint64) (*MediaAssetOwnerStats, error)
		withSession(session sqlx.Session) MediaAssetModel
	}

	MediaAssetOwnerStats struct {
		Total         int64 `db:"total"`
		ApprovedCount int64 `db:"approved_count"`
		PendingCount  int64 `db:"pending_count"`
		RejectedCount int64 `db:"rejected_count"`
	}

	customMediaAssetModel struct {
		*defaultMediaAssetModel
	}
)

// NewMediaAssetModel returns a model for the database table.
func NewMediaAssetModel(conn sqlx.SqlConn) MediaAssetModel {
	return &customMediaAssetModel{
		defaultMediaAssetModel: newMediaAssetModel(conn),
	}
}

func (m *customMediaAssetModel) withSession(session sqlx.Session) MediaAssetModel {
	return NewMediaAssetModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customMediaAssetModel) FindOneActive(ctx context.Context, id uint64) (*MediaAsset, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? and `status` <> 'deleted' and `deleted_at` is null limit 1", mediaAssetRows, m.table)
	var resp MediaAsset
	err := m.conn.QueryRowCtx(ctx, &resp, query, id)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *customMediaAssetModel) CountByWhere(ctx context.Context, whereSQL string, args ...any) (int64, error) {
	whereSQL = normalizeWhereSQL(whereSQL)
	query := fmt.Sprintf("select count(1) from %s %s", m.table, whereSQL)

	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, args...); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*MediaAsset, error) {
	resp := make(map[uint64]*MediaAsset)
	ids = modelutil.UniquePositiveIDs(ids)
	if len(ids) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `id` in (%s) and `status` <> 'deleted' and `deleted_at` is null", mediaAssetRows, m.table, modelutil.InPlaceholders(len(args)))
	var rows []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.Id] = row
		}
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindPublicApprovedByIDs(ctx context.Context, ids []uint64) (map[uint64]*MediaAsset, error) {
	return m.findPublicApprovedByIDs(ctx, 0, ids)
}

func (m *customMediaAssetModel) FindOwnerPublicApprovedByIDs(ctx context.Context, ownerUserID uint64, ids []uint64) (map[uint64]*MediaAsset, error) {
	if ownerUserID == 0 {
		return map[uint64]*MediaAsset{}, nil
	}
	return m.findPublicApprovedByIDs(ctx, ownerUserID, ids)
}

func (m *customMediaAssetModel) CountPublicApprovedByOwner(ctx context.Context, ownerUserID uint64) (int64, error) {
	if ownerUserID == 0 {
		return 0, nil
	}

	query := fmt.Sprintf(
		"select count(1) from %s where `owner_user_id` = ? and `status` = 'active' and `visibility` = 'public' and `audit_status` = 'approved' and `asset_usage` = 'work' and `deleted_at` is null",
		m.table,
	)
	var resp int64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, ownerUserID); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindPublicWorkByOwnersBeforeID(ctx context.Context, ownerIDs []uint64, beforeID uint64, limit int64) ([]*MediaAsset, error) {
	ownerIDs = modelutil.UniquePositiveIDs(ownerIDs)
	if len(ownerIDs) == 0 {
		return []*MediaAsset{}, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	args := make([]any, 0, len(ownerIDs)+2)
	for _, id := range ownerIDs {
		args = append(args, id)
	}
	conditions := []string{
		fmt.Sprintf("`owner_user_id` in (%s)", modelutil.InPlaceholders(len(ownerIDs))),
		"`status` = 'active'",
		"`visibility` in ('public','followers')",
		"`audit_status` = 'approved'",
		"`asset_usage` = 'work'",
		"`deleted_at` is null",
	}
	if beforeID > 0 {
		conditions = append(conditions, "`id` < ?")
		args = append(args, beforeID)
	}

	query := fmt.Sprintf("select %s from %s where %s order by `id` desc limit ?", mediaAssetRows, m.table, strings.Join(conditions, " and "))
	args = append(args, limit)

	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) findPublicApprovedByIDs(ctx context.Context, ownerUserID uint64, ids []uint64) (map[uint64]*MediaAsset, error) {
	resp := make(map[uint64]*MediaAsset)
	ids = modelutil.UniquePositiveIDs(ids)
	if len(ids) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(ids)+1)
	for _, id := range ids {
		args = append(args, id)
	}
	ownerSQL := ""
	if ownerUserID > 0 {
		ownerSQL = " and `owner_user_id` = ?"
		args = append(args, ownerUserID)
	}

	query := fmt.Sprintf(
		"select %s from %s where `id` in (%s)%s and `status` = 'active' and `visibility` = 'public' and `audit_status` = 'approved' and `asset_usage` = 'work' and `deleted_at` is null",
		mediaAssetRows,
		m.table,
		modelutil.InPlaceholders(len(ids)),
		ownerSQL,
	)
	var rows []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.Id] = row
		}
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByWhere(ctx context.Context, whereSQL, orderSQL string, limit, offset int64, args ...any) ([]*MediaAsset, error) {
	whereSQL = normalizeWhereSQL(whereSQL)
	orderSQL = normalizeOrderSQL(orderSQL)
	query := fmt.Sprintf("select %s from %s %s %s limit ? offset ?", mediaAssetRows, m.table, whereSQL, orderSQL)

	queryArgs := append(append([]any{}, args...), limit, offset)
	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, queryArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByWhereBeforeID(ctx context.Context, whereSQL, orderSQL string, beforeID, limit int64, args ...any) ([]*MediaAsset, error) {
	whereSQL = normalizeWhereSQL(whereSQL)
	if beforeID > 0 {
		if whereSQL == "" {
			whereSQL = "where `id` < ?"
		} else {
			whereSQL += " and `id` < ?"
		}
		args = append(args, uint64(beforeID))
	}

	orderSQL = normalizeOrderSQL(orderSQL)
	query := fmt.Sprintf("select %s from %s %s %s limit ?", mediaAssetRows, m.table, whereSQL, orderSQL)

	queryArgs := append(append([]any{}, args...), limit)
	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, queryArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByWhereBeforeCreatedAt(ctx context.Context, whereSQL string, beforeCreatedAt time.Time, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error) {
	whereSQL, args = appendCreatedCursorWhere(whereSQL, beforeCreatedAt, beforeID, args)
	whereSQL = normalizeWhereSQL(whereSQL)
	query := fmt.Sprintf("select %s from %s %s order by `created_at` desc, `id` desc limit ?", mediaAssetRows, m.table, whereSQL)

	queryArgs := append(append([]any{}, args...), limit)
	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, queryArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByWhereBeforeHotScore(ctx context.Context, whereSQL string, beforeScore float64, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error) {
	whereSQL, args = appendHotCursorWhere(whereSQL, beforeScore, beforeID, args)
	query, err := mediaRankingListSQL("hot_score", whereSQL)
	if err != nil {
		return nil, err
	}

	queryArgs := append(append([]any{}, args...), limit)
	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, queryArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindHotScoreByID(ctx context.Context, id uint64) (float64, error) {
	query := "select `hot_score` from `entity_ranking` where `target_type` = 'media_asset' and `target_id` = ? limit 1"
	var resp float64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, id); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindByWhereBeforeRisingScore(ctx context.Context, whereSQL string, beforeScore float64, beforeID uint64, limit int64, args ...any) ([]*MediaAsset, error) {
	whereSQL, args = appendRisingCursorWhere(whereSQL, beforeScore, beforeID, args)
	query, err := mediaRankingListSQL("rising_score", whereSQL)
	if err != nil {
		return nil, err
	}

	queryArgs := append(append([]any{}, args...), limit)
	var resp []*MediaAsset
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, queryArgs...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) FindRisingScoreByID(ctx context.Context, id uint64) (float64, error) {
	query := "select `rising_score` from `entity_ranking` where `target_type` = 'media_asset' and `target_id` = ? limit 1"
	var resp float64
	if err := m.conn.QueryRowCtx(ctx, &resp, query, id); err != nil {
		return 0, err
	}
	return resp, nil
}

func (m *customMediaAssetModel) CountStatsByOwner(ctx context.Context, ownerUserID uint64) (*MediaAssetOwnerStats, error) {
	query := fmt.Sprintf(
		"select count(1) as total, coalesce(sum(`audit_status` = 'approved'), 0) as approved_count, coalesce(sum(`audit_status` = 'pending'), 0) as pending_count, coalesce(sum(`audit_status` = 'rejected'), 0) as rejected_count from %s where `owner_user_id` = ? and `status` <> 'deleted' and `deleted_at` is null",
		m.table,
	)

	var resp MediaAssetOwnerStats
	if err := m.conn.QueryRowCtx(ctx, &resp, query, ownerUserID); err != nil {
		return nil, err
	}
	return &resp, nil
}

func appendHotCursorWhere(whereSQL string, beforeScore float64, beforeID uint64, args []any) (string, []any) {
	if beforeID == 0 {
		return whereSQL, args
	}

	condition := "(er.`hot_score` < ? or (er.`hot_score` = ? and er.`target_id` < ?))"
	if strings.TrimSpace(whereSQL) == "" {
		whereSQL = condition
	} else {
		whereSQL += " and " + condition
	}
	args = append(args, beforeScore, beforeScore, beforeID)
	return whereSQL, args
}

func appendRisingCursorWhere(whereSQL string, beforeScore float64, beforeID uint64, args []any) (string, []any) {
	if beforeID == 0 {
		return whereSQL, args
	}

	condition := "(er.`rising_score` < ? or (er.`rising_score` = ? and er.`target_id` < ?))"
	if strings.TrimSpace(whereSQL) == "" {
		whereSQL = condition
	} else {
		whereSQL += " and " + condition
	}
	args = append(args, beforeScore, beforeScore, beforeID)
	return whereSQL, args
}

func mediaRankingListSQL(scoreColumn, whereSQL string) (string, error) {
	var indexName string
	switch scoreColumn {
	case "hot_score":
		indexName = "idx_entity_ranking_hot"
	case "rising_score":
		indexName = "idx_entity_ranking_rising"
	default:
		return "", fmt.Errorf("unsupported media ranking score column: %s", scoreColumn)
	}

	conditions := "er.`target_type` = 'media_asset'"
	whereSQL = normalizeWhereSQL(whereSQL)
	if whereSQL != "" {
		conditions += " and " + strings.TrimSpace(whereSQL[len("where "):])
	}

	return fmt.Sprintf(
		"select %s from `entity_ranking` er force index (`%s`) straight_join `media_asset` on `media_asset`.`id` = er.`target_id` where %s order by er.`%s` desc, er.`target_id` desc limit ?",
		mediaAssetRows,
		indexName,
		conditions,
		scoreColumn,
	), nil
}

func appendCreatedCursorWhere(whereSQL string, beforeCreatedAt time.Time, beforeID uint64, args []any) (string, []any) {
	if beforeID == 0 || beforeCreatedAt.IsZero() {
		return whereSQL, args
	}

	condition := "(`created_at` < ? or (`created_at` = ? and `id` < ?))"
	if strings.TrimSpace(whereSQL) == "" {
		whereSQL = condition
	} else {
		whereSQL += " and " + condition
	}
	args = append(args, beforeCreatedAt, beforeCreatedAt, beforeID)
	return whereSQL, args
}

func normalizeWhereSQL(whereSQL string) string {
	whereSQL = strings.TrimSpace(whereSQL)
	if whereSQL == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(whereSQL), "where ") {
		return whereSQL
	}
	return "where " + whereSQL
}

func normalizeOrderSQL(orderSQL string) string {
	orderSQL = strings.TrimSpace(orderSQL)
	if orderSQL == "" {
		return "order by `id` desc"
	}
	if strings.HasPrefix(strings.ToLower(orderSQL), "order by ") {
		return orderSQL
	}
	return "order by " + orderSQL
}
