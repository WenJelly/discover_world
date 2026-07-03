// Code scaffolded by goctl. Safe to edit.
// goctl 1.10.1

package account

import (
	"context"
	"database/sql"
	"strings"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/zeromicro/go-zero/core/logx"
	"golang.org/x/crypto/bcrypt"
)

type RegisterAccountLogic struct {
	logx.Logger
	ctx    context.Context
	svcCtx *svc.ServiceContext
}

func NewRegisterAccountLogic(ctx context.Context, svcCtx *svc.ServiceContext) *RegisterAccountLogic {
	return &RegisterAccountLogic{
		Logger: logx.WithContext(ctx),
		ctx:    ctx,
		svcCtx: svcCtx,
	}
}

func (l *RegisterAccountLogic) RegisterAccount(req *types.RegisterRequest) (resp *types.RegisterResponse, err error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}

	email, err := normalizeEmail(req.Email)
	if err != nil {
		return nil, err
	}
	password, err := normalizePassword(req.Password)
	if err != nil {
		return nil, err
	}
	if password != strings.TrimSpace(req.CheckPassword) {
		return nil, commonresponse.BadRequest("两次密码不一致")
	}
	username, err := normalizeUsername(req.Username, email)
	if err != nil {
		return nil, err
	}
	if err := ensureEmailAvailable(l.ctx, l.svcCtx, 0, email); err != nil {
		return nil, err
	}
	if err := ensureUsernameAvailable(l.ctx, l.svcCtx, 0, username); err != nil {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, commonresponse.InternalServerError("密码加密失败")
	}

	account := &model.UserAccount{
		Username:     username,
		Email:        sql.NullString{String: email, Valid: true},
		PasswordHash: sql.NullString{String: string(hash), Valid: true},
		Status:       "active",
	}
	result, err := l.svcCtx.UserAccountModel.Insert(l.ctx, account)
	if err != nil {
		return nil, commonresponse.InternalServerError("创建账号失败")
	}
	id, err := result.LastInsertId()
	if err != nil || id <= 0 {
		return nil, commonresponse.InternalServerError("读取账号ID失败")
	}
	account.Id = uint64(id)

	_, _ = l.svcCtx.UserProfileModel.Insert(l.ctx, &model.UserProfile{
		UserId:   account.Id,
		Nickname: optionalString(username),
	})

	return &types.RegisterResponse{Id: formatID(account.Id)}, nil
}
