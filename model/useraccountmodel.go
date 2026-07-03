package model

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ UserAccountModel = (*customUserAccountModel)(nil)

type (
	// UserAccountModel is an interface to be customized, add more methods here,
	// and implement the added methods in customUserAccountModel.
	UserAccountModel interface {
		userAccountModel
		FindOneActive(ctx context.Context, id uint64) (*UserAccount, error)
		FindByIDs(ctx context.Context, ids []uint64) ([]*UserAccount, error)
		UpdateLastLogin(ctx context.Context, id uint64, loginAt time.Time) error
		withSession(session sqlx.Session) UserAccountModel
	}

	customUserAccountModel struct {
		*defaultUserAccountModel
	}
)

// NewUserAccountModel returns a model for the database table.
func NewUserAccountModel(conn sqlx.SqlConn) UserAccountModel {
	return &customUserAccountModel{
		defaultUserAccountModel: newUserAccountModel(conn),
	}
}

func (m *customUserAccountModel) withSession(session sqlx.Session) UserAccountModel {
	return NewUserAccountModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customUserAccountModel) FindOneActive(ctx context.Context, id uint64) (*UserAccount, error) {
	query := fmt.Sprintf("select %s from %s where `id` = ? and `status` = 'active' and `deleted_at` is null limit 1", userAccountRows, m.table)
	var resp UserAccount
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

func (m *customUserAccountModel) FindByIDs(ctx context.Context, ids []uint64) ([]*UserAccount, error) {
	ids = uniquePositiveIDs(ids)
	if len(ids) == 0 {
		return []*UserAccount{}, nil
	}

	args := make([]any, 0, len(ids))
	for _, id := range ids {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `id` in (%s) and `deleted_at` is null", userAccountRows, m.table, inPlaceholders(len(args)))
	var resp []*UserAccount
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, args...); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customUserAccountModel) UpdateLastLogin(ctx context.Context, id uint64, loginAt time.Time) error {
	query := fmt.Sprintf("update %s set `last_login_at` = ? where `id` = ?", m.table)
	_, err := m.conn.ExecCtx(ctx, query, sql.NullTime{Time: loginAt, Valid: !loginAt.IsZero()}, id)
	return err
}
