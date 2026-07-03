package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ StorageBucketModel = (*customStorageBucketModel)(nil)

type (
	// StorageBucketModel is an interface to be customized, add more methods here,
	// and implement the added methods in customStorageBucketModel.
	StorageBucketModel interface {
		storageBucketModel
		FindDefaultActiveByUsage(ctx context.Context, usageType string) (*StorageBucket, error)
		FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*StorageBucket, error)
		withSession(session sqlx.Session) StorageBucketModel
	}

	customStorageBucketModel struct {
		*defaultStorageBucketModel
	}
)

// NewStorageBucketModel returns a model for the database table.
func NewStorageBucketModel(conn sqlx.SqlConn) StorageBucketModel {
	return &customStorageBucketModel{
		defaultStorageBucketModel: newStorageBucketModel(conn),
	}
}

func (m *customStorageBucketModel) withSession(session sqlx.Session) StorageBucketModel {
	return NewStorageBucketModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customStorageBucketModel) FindDefaultActiveByUsage(ctx context.Context, usageType string) (*StorageBucket, error) {
	query := fmt.Sprintf("select %s from %s where `usage_type` = ? and `status` = 1 order by `is_default` desc, `id` asc limit 1", storageBucketRows, m.table)
	var resp StorageBucket
	err := m.conn.QueryRowCtx(ctx, &resp, query, usageType)
	switch err {
	case nil:
		return &resp, nil
	case sqlx.ErrNotFound:
		return nil, ErrNotFound
	default:
		return nil, err
	}
}

func (m *customStorageBucketModel) FindByIDs(ctx context.Context, ids []uint64) (map[uint64]*StorageBucket, error) {
	resp := make(map[uint64]*StorageBucket)
	ids = uniquePositiveIDs(ids)
	if len(ids) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `id` in (%s)", storageBucketRows, m.table, inPlaceholders(len(args)))
	var rows []*StorageBucket
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
