package admin

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

const adminRolePolicyRows = "`id`,`role`,`capability`,`status`,`created_at`,`updated_at`"

type (
	AdminRolePolicyModel interface {
		Insert(ctx context.Context, data *AdminRolePolicy) (sql.Result, error)
		HasCapability(ctx context.Context, role string, capability string) (bool, error)
		withSession(session sqlx.Session) AdminRolePolicyModel
	}

	defaultAdminRolePolicyModel struct {
		conn  sqlx.SqlConn
		table string
	}

	AdminRolePolicy struct {
		Id         uint64    `db:"id"`
		Role       string    `db:"role"`
		Capability string    `db:"capability"`
		Status     int64     `db:"status"`
		CreatedAt  time.Time `db:"created_at"`
		UpdatedAt  time.Time `db:"updated_at"`
	}
)

func NewAdminRolePolicyModel(conn sqlx.SqlConn) AdminRolePolicyModel {
	return &defaultAdminRolePolicyModel{
		conn:  conn,
		table: "`admin_role_policy`",
	}
}

func (m *defaultAdminRolePolicyModel) withSession(session sqlx.Session) AdminRolePolicyModel {
	return NewAdminRolePolicyModel(sqlx.NewSqlConnFromSession(session))
}

func (m *defaultAdminRolePolicyModel) Insert(ctx context.Context, data *AdminRolePolicy) (sql.Result, error) {
	query := fmt.Sprintf("insert into %s (`role`,`capability`,`status`) values (?, ?, ?) on duplicate key update `status` = values(`status`)", m.table)
	return m.conn.ExecCtx(ctx, query, data.Role, data.Capability, data.Status)
}

func (m *defaultAdminRolePolicyModel) HasCapability(ctx context.Context, role string, capability string) (bool, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	capability = strings.TrimSpace(capability)
	if role == "" || capability == "" {
		return false, nil
	}

	query := fmt.Sprintf("select count(1) from %s where `role` = ? and `capability` = ? and `status` = 1", m.table)
	var count int64
	if err := m.conn.QueryRowCtx(ctx, &count, query, role, capability); err != nil {
		return false, err
	}
	return count > 0, nil
}
