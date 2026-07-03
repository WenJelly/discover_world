package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ AssetLinkModel = (*customAssetLinkModel)(nil)

type (
	// AssetLinkModel is an interface to be customized, add more methods here,
	// and implement the added methods in customAssetLinkModel.
	AssetLinkModel interface {
		assetLinkModel
		CountActiveByOwners(ctx context.Context, ownerType, linkRole string, ownerIDs []uint64) (map[uint64]int64, error)
		FindActiveAssetIDsByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string, limit int64) ([]uint64, error)
		FindActiveAssetIDsByOwners(ctx context.Context, ownerType, linkRole string, ownerIDs []uint64) (map[uint64][]uint64, error)
		withSession(session sqlx.Session) AssetLinkModel
	}

	customAssetLinkModel struct {
		*defaultAssetLinkModel
	}
)

// NewAssetLinkModel returns a model for the database table.
func NewAssetLinkModel(conn sqlx.SqlConn) AssetLinkModel {
	return &customAssetLinkModel{
		defaultAssetLinkModel: newAssetLinkModel(conn),
	}
}

func (m *customAssetLinkModel) withSession(session sqlx.Session) AssetLinkModel {
	return NewAssetLinkModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customAssetLinkModel) FindActiveAssetIDsByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string, limit int64) ([]uint64, error) {
	if limit <= 0 {
		limit = 20
	}

	query := fmt.Sprintf("select `asset_id` from %s where `owner_type` = ? and `owner_id` = ? and `link_role` = ? and `status` = 1 order by `sort_order` asc, `id` asc limit ?", m.table)
	var rows []struct {
		AssetId uint64 `db:"asset_id"`
	}
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, ownerType, ownerID, linkRole, limit); err != nil {
		return nil, err
	}
	resp := make([]uint64, 0, len(rows))
	for _, row := range rows {
		resp = append(resp, row.AssetId)
	}
	return resp, nil
}

func (m *customAssetLinkModel) FindActiveAssetIDsByOwners(ctx context.Context, ownerType, linkRole string, ownerIDs []uint64) (map[uint64][]uint64, error) {
	resp := make(map[uint64][]uint64)
	args := []any{ownerType, linkRole}
	for _, id := range ownerIDs {
		if id > 0 {
			args = append(args, id)
		}
	}
	if len(args) == 2 {
		return resp, nil
	}

	query := fmt.Sprintf("select `owner_id`, `asset_id` from %s where `owner_type` = ? and `link_role` = ? and `status` = 1 and `owner_id` in (%s) order by `owner_id` asc, `sort_order` asc, `id` asc", m.table, inPlaceholders(len(args)-2))
	var rows []struct {
		OwnerId uint64 `db:"owner_id"`
		AssetId uint64 `db:"asset_id"`
	}
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		resp[row.OwnerId] = append(resp[row.OwnerId], row.AssetId)
	}
	return resp, nil
}

func (m *customAssetLinkModel) CountActiveByOwners(ctx context.Context, ownerType, linkRole string, ownerIDs []uint64) (map[uint64]int64, error) {
	resp := make(map[uint64]int64)
	args := []any{ownerType, linkRole}
	for _, id := range ownerIDs {
		if id > 0 {
			args = append(args, id)
		}
	}
	if len(args) == 2 {
		return resp, nil
	}

	query := fmt.Sprintf("select `owner_id`, count(1) as `item_count` from %s where `owner_type` = ? and `link_role` = ? and `status` = 1 and `owner_id` in (%s) group by `owner_id`", m.table, inPlaceholders(len(args)-2))
	var rows []struct {
		OwnerId   uint64 `db:"owner_id"`
		ItemCount int64  `db:"item_count"`
	}
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		resp[row.OwnerId] = row.ItemCount
	}
	return resp, nil
}
