package auth

import (
	"context"

	"discover_world/model"
)

type loginUserContextKey struct{}

func WithLoginUser(ctx context.Context, user *model.UserAccount) context.Context {
	if ctx == nil || user == nil {
		return ctx
	}

	return context.WithValue(ctx, loginUserContextKey{}, user)
}

func LoginUserFromContext(ctx context.Context) (*model.UserAccount, bool) {
	if ctx == nil {
		return nil, false
	}

	user, ok := ctx.Value(loginUserContextKey{}).(*model.UserAccount)
	return user, ok && user != nil
}
