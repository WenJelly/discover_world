package model

import (
	"context"
	"fmt"
	"strings"

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
		FindByWhere(ctx context.Context, whereSQL, orderSQL string, limit, offset int64, args ...any) ([]*MediaAsset, error)
		FindByWhereBeforeID(ctx context.Context, whereSQL, orderSQL string, beforeID, limit int64, args ...any) ([]*MediaAsset, error)
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
	ids = uniquePositiveIDs(ids)
	if len(ids) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `id` in (%s) and `status` <> 'deleted' and `deleted_at` is null", mediaAssetRows, m.table, inPlaceholders(len(args)))
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

func (m *customMediaAssetModel) findPublicApprovedByIDs(ctx context.Context, ownerUserID uint64, ids []uint64) (map[uint64]*MediaAsset, error) {
	resp := make(map[uint64]*MediaAsset)
	ids = uniquePositiveIDs(ids)
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
		inPlaceholders(len(ids)),
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
