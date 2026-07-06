package model

import (
	"context"
	"fmt"

	"github.com/zeromicro/go-zero/core/stores/sqlx"
)

var _ UserProfileModel = (*customUserProfileModel)(nil)

type (
	// UserProfileModel is an interface to be customized, add more methods here,
	// and implement the added methods in customUserProfileModel.
	UserProfileModel interface {
		userProfileModel
		FindAvatarReferencesByAssetID(ctx context.Context, assetID uint64) ([]*UserProfile, error)
		FindByUserIDs(ctx context.Context, userIDs []uint64) (map[uint64]*UserProfile, error)
		withSession(session sqlx.Session) UserProfileModel
	}

	customUserProfileModel struct {
		*defaultUserProfileModel
	}
)

// NewUserProfileModel returns a model for the database table.
func NewUserProfileModel(conn sqlx.SqlConn) UserProfileModel {
	return &customUserProfileModel{
		defaultUserProfileModel: newUserProfileModel(conn),
	}
}

func (m *customUserProfileModel) withSession(session sqlx.Session) UserProfileModel {
	return NewUserProfileModel(sqlx.NewSqlConnFromSession(session))
}

func (m *customUserProfileModel) FindAvatarReferencesByAssetID(ctx context.Context, assetID uint64) ([]*UserProfile, error) {
	if assetID == 0 {
		return []*UserProfile{}, nil
	}

	query := fmt.Sprintf("select %s from %s where `avatar_asset_id` = ? order by `user_id` asc", userProfileRows, m.table)
	var resp []*UserProfile
	if err := m.conn.QueryRowsCtx(ctx, &resp, query, assetID); err != nil {
		return nil, err
	}
	return resp, nil
}

func (m *customUserProfileModel) FindByUserIDs(ctx context.Context, userIDs []uint64) (map[uint64]*UserProfile, error) {
	resp := make(map[uint64]*UserProfile)
	userIDs = uniquePositiveIDs(userIDs)
	if len(userIDs) == 0 {
		return resp, nil
	}

	args := make([]any, 0, len(userIDs))
	for _, id := range userIDs {
		args = append(args, id)
	}

	query := fmt.Sprintf("select %s from %s where `user_id` in (%s)", userProfileRows, m.table, inPlaceholders(len(args)))
	var rows []*UserProfile
	if err := m.conn.QueryRowsCtx(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for _, row := range rows {
		if row != nil {
			resp[row.UserId] = row
		}
	}
	return resp, nil
}
