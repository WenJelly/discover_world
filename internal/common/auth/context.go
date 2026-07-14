package auth

import (
	"context"
	accountmodel "discover_world/model/account"
)

type loginUserContextKey struct{}

func WithLoginUser(ctx context.Context, user *accountmodel.UserAccount) context.Context {
	if ctx == nil || user == nil {
		return ctx
	}

	return context.WithValue(ctx, loginUserContextKey{}, user)
}

func LoginUserFromContext(ctx context.Context) (*accountmodel.UserAccount, bool) {
	if ctx == nil {
		return nil, false
	}

	user, ok := ctx.Value(loginUserContextKey{}).(*accountmodel.UserAccount)
	return user, ok && user != nil
}
