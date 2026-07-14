package media

import (
	"context"
	"discover_world/model/internal/modelutil"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ MediaObjectModel = (*customMediaObjectModel)(nil)

type (
	// MediaObjectModel is an interface to be customized, add more methods here,
	// and implement the added methods in customMediaObjectModel.
	MediaObjectModel interface {
		mediaObjectModel
		FindOriginalByAssetID(ctx context.Context, assetID uint64) (*MediaObject, error)
		FindOriginalByAssetIDs(ctx context.Context, assetIDs []uint64) (map[uint64]*MediaObject, error)
		MarkDeletedByAssetID(ctx context.Context, assetID uint64) error
		withSession(session sqlx.Session) MediaObjectModel
	}

	customMediaObjectModel struct {
		*defaultMediaObjectModel
	}
)

// NewMediaObjectModel returns a model for the database table.
func NewMediaObjectModel(conn sqlx.SqlConn) MediaObjectModel {
	return &customMediaObjectModel{
		defaultMediaObjectModel: newMediaObjectModel(conn),
	}
}

func (m *customMediaObjectModel) withSession(session sqlx.Session) MediaObjectModel {
	return NewMediaObjectModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customMediaObjectModel) FindOriginalByAssetID(ctx context.Context, assetID uint64) (*MediaObject, error) {
	query := fmt.Sprintf("select %s from %s where `asset_id` = ? and `object_role` = 'original' and `status` = 'active' limit 1", mediaObjectRows, m.table)
	var resp MediaObject
	err := m.conn.QueryRowCtx(ctx, &resp, query, assetID)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *customMediaObjectModel) FindOriginalByAssetIDs(ctx context.Context, assetIDs []uint64) (map[uint64]*MediaObject, error) {
	resp := make(map[uint64]*MediaObject)
	assetIDs = modelutil.UniquePositiveIDs(assetIDs)
	if len(assetIDs) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(assetIDs))
	for _, id := range assetIDs {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `asset_id` in (%s) and `object_role` = 'original' and `status` = 'active'", mediaObjectRows, m.table, modelutil.InPlaceholders(len(args)))
	var rows []*MediaObject
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.AssetId] = row
		}
	}
	return resp, nil
}

func (m *customMediaObjectModel) MarkDeletedByAssetID(ctx context.Context, assetID uint64) error {
	query := fmt.Sprintf("update %s set `status` = 'deleted' where `asset_id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, assetID)
	return err
}
