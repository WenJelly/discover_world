package media

import (
	"context"
	"discover_world/model/internal/modelutil"
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
		DeactivateActiveByAssetIDAndOwnerRole(ctx context.Context, assetID uint64, ownerType, linkRole string) error
		DeactivateByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string) error
		FindActiveByAssetID(ctx context.Context, assetID uint64) ([]*AssetLink, error)
		FindActiveAssetIDsByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string, limit int64) ([]uint64, error)
		FindActiveAssetIDsByOwners(ctx context.Context, ownerType, linkRole string, ownerIDs []uint64) (map[uint64][]uint64, error)
		ReplaceActiveAssetIDsByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string, assetIDs []uint64) error
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

func (m *customAssetLinkModel) DeactivateByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string) error {
	query := fmt.Sprintf("update %s set `status` = 0 where `owner_type` = ? and `owner_id` = ? and `link_role` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, ownerType, ownerID, linkRole)
	return err
}

func (m *customAssetLinkModel) DeactivateActiveByAssetIDAndOwnerRole(ctx context.Context, assetID uint64, ownerType, linkRole string) error {
	if assetID == 0 {
		return nil
	}

	query := fmt.Sprintf("update %s set `status` = 0 where `asset_id` = ? and `owner_type` = ? and `link_role` = ? and `status` = 1", m.table)
	_, err := m.conn.ExecCtx(ctx, query, assetID, ownerType, linkRole)
	return err
}

func (m *customAssetLinkModel) FindActiveByAssetID(ctx context.Context, assetID uint64) ([]*AssetLink, error) {
	if assetID == 0 {
		return []*AssetLink{}, nil
	}

	query := fmt.Sprintf("select %s from %s where `asset_id` = ? and `status` = 1 order by `owner_type` asc, `owner_id` asc, `link_role` asc, `id` asc", assetLinkRows, m.table)
	var resp []*AssetLink
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, assetID); err != nil {
		return nil, err
	}
	return resp, nil
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

	query := fmt.Sprintf("select `owner_id`, `asset_id` from %s where `owner_type` = ? and `link_role` = ? and `status` = 1 and `owner_id` in (%s) order by `owner_id` asc, `sort_order` asc, `id` asc", m.table, modelutil.InPlaceholders(len(args)-2))
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

	query := fmt.Sprintf("select `owner_id`, count(1) as `item_count` from %s where `owner_type` = ? and `link_role` = ? and `status` = 1 and `owner_id` in (%s) group by `owner_id`", m.table, modelutil.InPlaceholders(len(args)-2))
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

func (m *customAssetLinkModel) ReplaceActiveAssetIDsByOwner(ctx context.Context, ownerType string, ownerID uint64, linkRole string, assetIDs []uint64) error {
	if err := m.DeactivateByOwner(ctx, ownerType, ownerID, linkRole); err != nil {
		return err
	}

	query := fmt.Sprintf("insert into %s (`asset_id`,`owner_type`,`owner_id`,`link_role`,`sort_order`,`status`) values (?, ?, ?, ?, ?, 1) on duplicate key update `sort_order` = values(`sort_order`), `status` = values(`status`)", m.table)
	for index, assetID := range modelutil.UniquePositiveIDs(assetIDs) {
		if _, err := m.conn.ExecCtx(ctx, query, assetID, ownerType, ownerID, linkRole, index); err != nil {
			return err
		}
	}
	return nil
}
