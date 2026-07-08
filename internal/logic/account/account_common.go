package account

import (
	"context"
	"database/sql"
	"errors"
	"net/mail"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	mediaLogic "discover_world/internal/logic/media"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"

	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

const (
	maxUsernameLength = 50
	maxNicknameLength = 100
	maxBioLength      = 512
	minPasswordLength = 8
	maxRoleLength     = 50
	defaultRole       = "user"
)

func buildDetailAccountResponse(_ *svc.ServiceContext, account *model.UserAccount, profile *model.UserProfile, stats *model.MediaAssetOwnerStats, publicMediaAssetCount int64) *types.DetailAccountResponse {
	if account == nil {
		return &types.DetailAccountResponse{}
	}
	if stats == nil {
		stats = &model.MediaAssetOwnerStats{}
	}

	nickname := ""
	bio := ""
	avatarURL := ""
	if profile != nil {
		nickname = nullStringValue(profile.Nickname)
		bio = nullStringValue(profile.Bio)
	}
	if nickname == "" {
		nickname = account.Username
	}

	return &types.DetailAccountResponse{
		Id:                      formatID(account.Id),
		Username:                account.Username,
		Email:                   nullStringValue(account.Email),
		Phone:                   nullStringValue(account.Phone),
		Nickname:                nickname,
		AvatarUrl:               avatarURL,
		Bio:                     bio,
		Status:                  account.Status,
		Role:                    accountRole(account),
		CreatedAt:               formatTime(account.CreatedAt),
		UpdatedAt:               formatTime(account.UpdatedAt),
		MediaAssetCount:         stats.Total,
		PublicMediaAssetCount:   publicMediaAssetCount,
		ApprovedMediaAssetCount: stats.ApprovedCount,
		PendingMediaAssetCount:  stats.PendingCount,
		RejectedMediaAssetCount: stats.RejectedCount,
	}
}

func loadDetailAccountResponse(ctx context.Context, svcCtx *svc.ServiceContext, account *model.UserAccount) (*types.DetailAccountResponse, error) {
	profile, err := ensureUserProfile(ctx, svcCtx, account)
	if err != nil {
		return nil, err
	}
	stats, err := svcCtx.MediaAssetModel.CountStatsByOwner(ctx, account.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询媒体资源统计失败")
	}
	publicMediaAssetCount, err := svcCtx.MediaAssetModel.CountPublicApprovedByOwner(ctx, account.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询公开媒体资源统计失败")
	}
	followerCount, err := svcCtx.UserFollowModel.CountFollowers(ctx, account.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询粉丝数失败")
	}
	followingCount, err := svcCtx.UserFollowModel.CountFollowing(ctx, account.Id)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询关注数失败")
	}

	resp := buildDetailAccountResponse(svcCtx, account, profile, stats, publicMediaAssetCount)
	applyFollowState(resp, followerCount, followingCount, false)
	resp.AvatarUrl = mediaLogic.LoadAvatarURL(ctx, svcCtx, profile)
	return resp, nil
}

func applyFollowState(resp *types.DetailAccountResponse, followerCount, followingCount int64, isFollowing bool) {
	if resp == nil {
		return
	}
	resp.FollowerCount = followerCount
	resp.FollowingCount = followingCount
	resp.IsFollowing = isFollowing
}

func canViewAccountDetail(svcCtx *svc.ServiceContext, viewer, target *model.UserAccount) bool {
	if viewer == nil || target == nil {
		return false
	}
	if viewer.Id == target.Id || isAdminAccountForDetail(svcCtx, viewer) {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(target.Status), "active") && !target.DeletedAt.Valid
}

func maskDetailAccountForViewer(svcCtx *svc.ServiceContext, viewer, target *model.UserAccount, resp *types.DetailAccountResponse) {
	if resp == nil || viewer == nil || target == nil {
		return
	}
	if viewer.Id == target.Id || isAdminAccountForDetail(svcCtx, viewer) {
		return
	}

	resp.Email = ""
	resp.Phone = ""
	resp.MediaAssetCount = resp.PublicMediaAssetCount
	resp.ApprovedMediaAssetCount = resp.PublicMediaAssetCount
	resp.PendingMediaAssetCount = 0
	resp.RejectedMediaAssetCount = 0
}

func isAdminAccountForDetail(svcCtx *svc.ServiceContext, account *model.UserAccount) bool {
	if svcCtx != nil {
		return svcCtx.IsAdminAccount(account)
	}
	return account != nil && strings.EqualFold(strings.TrimSpace(account.Role), "admin")
}

func ensureUserProfile(ctx context.Context, svcCtx *svc.ServiceContext, account *model.UserAccount) (*model.UserProfile, error) {
	profile, err := svcCtx.UserProfileModel.FindOneByUserId(ctx, account.Id)
	if err == nil {
		return profile, nil
	}
	if !errors.Is(err, model.ErrNotFound) {
		return nil, commonresponse.InternalServerError("查询用户资料失败")
	}

	profile = &model.UserProfile{
		UserId:   account.Id,
		Nickname: optionalString(account.Username),
	}
	if _, err := svcCtx.UserProfileModel.Insert(ctx, profile); err != nil {
		return nil, commonresponse.InternalServerError("创建用户资料失败")
	}
	return svcCtx.UserProfileModel.FindOneByUserId(ctx, account.Id)
}

func buildLoginResponse(token string, detail *types.DetailAccountResponse) *types.LoginResponse {
	if detail == nil {
		return &types.LoginResponse{Token: token}
	}
	return &types.LoginResponse{
		Token:     token,
		Id:        detail.Id,
		Username:  detail.Username,
		Email:     detail.Email,
		Phone:     detail.Phone,
		Nickname:  detail.Nickname,
		AvatarUrl: detail.AvatarUrl,
		Bio:       detail.Bio,
		Status:    detail.Status,
		Role:      detail.Role,
		CreatedAt: detail.CreatedAt,
		UpdatedAt: detail.UpdatedAt,
	}
}

func createToken(svcCtx *svc.ServiceContext, account *model.UserAccount) (string, error) {
	now := time.Now().Unix()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"userId": formatID(account.Id),
		"iat":    now,
		"exp":    now + svcCtx.Config.Auth.AccessExpire,
	})
	return token.SignedString([]byte(svcCtx.Config.Auth.AccessSecret))
}

func formatID(id uint64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatUint(id, 10)
}

func parseRequiredID(raw, field string) (uint64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil || id == 0 {
		return 0, commonresponse.BadRequest(field + " 必须是正整数")
	}
	return id, nil
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}

func formatTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Format("2006-01-02 15:04:05")
}

func optionalString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func normalizeEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", commonresponse.BadRequest("email 不能为空")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", commonresponse.BadRequest("email 格式无效")
	}
	return email, nil
}

func normalizeLoginEmail(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", commonresponse.BadRequest("email 不能为空")
	}
	if _, err := mail.ParseAddress(email); err != nil {
		return "", commonresponse.BadRequest("email 格式无效")
	}
	return email, nil
}

func normalizePassword(password string) (string, error) {
	password = strings.TrimSpace(password)
	if len(password) < minPasswordLength {
		return "", commonresponse.BadRequest("password 长度不能少于 8")
	}
	return password, nil
}

func accountRole(account *model.UserAccount) string {
	if account == nil {
		return defaultRole
	}
	role := strings.TrimSpace(account.Role)
	if role == "" {
		return defaultRole
	}
	return role
}

func normalizeRole(role string) (string, error) {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		return "", commonresponse.BadRequest("role 不能为空")
	}
	if utf8.RuneCountInString(role) > maxRoleLength {
		return "", commonresponse.BadRequest("role 长度不能超过 50")
	}
	return role, nil
}

func normalizeUsername(username, email string) (string, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		username = strings.Split(email, "@")[0]
	}
	if username == "" {
		return "", commonresponse.BadRequest("username 不能为空")
	}
	if utf8.RuneCountInString(username) > maxUsernameLength {
		return "", commonresponse.BadRequest("username 长度不能超过 50")
	}
	return username, nil
}

func ensureEmailAvailable(ctx context.Context, svcCtx *svc.ServiceContext, accountID uint64, email string) error {
	if strings.TrimSpace(email) == "" {
		return nil
	}
	existing, err := svcCtx.UserAccountModel.FindOneByEmail(ctx, sql.NullString{String: email, Valid: true})
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil
		}
		return commonresponse.InternalServerError("查询邮箱失败")
	}
	if existing.Id != accountID && !existing.DeletedAt.Valid {
		return commonresponse.Conflict("邮箱已注册")
	}
	return nil
}

func ensureUsernameAvailable(ctx context.Context, svcCtx *svc.ServiceContext, accountID uint64, username string) error {
	if strings.TrimSpace(username) == "" {
		return nil
	}
	existing, err := svcCtx.UserAccountModel.FindOneByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil
		}
		return commonresponse.InternalServerError("查询用户名失败")
	}
	if existing.Id != accountID && !existing.DeletedAt.Valid {
		return commonresponse.Conflict("用户名已存在")
	}
	return nil
}

func loadLoginAccount(ctx context.Context, svcCtx *svc.ServiceContext) (*model.UserAccount, error) {
	return commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
}

func applyProfilePatch(profile *model.UserProfile, nickname, bio string) error {
	if value := strings.TrimSpace(nickname); value != "" {
		if utf8.RuneCountInString(value) > maxNicknameLength {
			return commonresponse.BadRequest("nickname 长度不能超过 100")
		}
		profile.Nickname = optionalString(value)
	}
	if value := strings.TrimSpace(bio); value != "" {
		if utf8.RuneCountInString(value) > maxBioLength {
			return commonresponse.BadRequest("bio 长度不能超过 512")
		}
		profile.Bio = optionalString(value)
	}
	return nil
}

func updateAccountByAdmin(ctx context.Context, svcCtx *svc.ServiceContext, req *types.AdminUpdateAccountRequest) (*types.DetailAccountResponse, error) {
	if req == nil {
		return nil, commonresponse.BadRequest("请求不能为空")
	}
	id, err := parseRequiredID(req.Id, "id")
	if err != nil {
		return nil, err
	}
	account, err := svcCtx.UserAccountModel.FindOne(ctx, id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, commonresponse.NotFound("账号不存在")
		}
		return nil, commonresponse.InternalServerError("查询账号失败")
	}

	if err := applyAccountPatch(ctx, svcCtx, account, req.Username, req.Email, req.Password, req.Role, req.Status, true, true); err != nil {
		return nil, err
	}
	profile, err := ensureUserProfile(ctx, svcCtx, account)
	if err != nil {
		return nil, err
	}
	if err := applyProfilePatch(profile, req.Nickname, req.Bio); err != nil {
		return nil, err
	}
	if err := svcCtx.UserProfileModel.Update(ctx, profile); err != nil {
		return nil, commonresponse.InternalServerError("更新用户资料失败")
	}
	if err := svcCtx.UserAccountModel.Update(ctx, account); err != nil {
		return nil, commonresponse.InternalServerError("更新账号失败")
	}
	return loadDetailAccountResponse(ctx, svcCtx, account)
}

func UpdateAccountByAdmin(ctx context.Context, svcCtx *svc.ServiceContext, req *types.AdminUpdateAccountRequest) (*types.DetailAccountResponse, error) {
	return updateAccountByAdmin(ctx, svcCtx, req)
}

func applyAccountPatch(ctx context.Context, svcCtx *svc.ServiceContext, account *model.UserAccount, username, email, password, role, status string, allowRole, allowStatus bool) error {
	if value := strings.TrimSpace(username); value != "" {
		username, err := normalizeUsername(value, nullStringValue(account.Email))
		if err != nil {
			return err
		}
		if err := ensureUsernameAvailable(ctx, svcCtx, account.Id, username); err != nil {
			return err
		}
		account.Username = username
	}

	if value := strings.TrimSpace(email); value != "" {
		normalized, err := normalizeEmail(value)
		if err != nil {
			return err
		}
		if err := ensureEmailAvailable(ctx, svcCtx, account.Id, normalized); err != nil {
			return err
		}
		account.Email = sql.NullString{String: normalized, Valid: true}
	}

	if value := strings.TrimSpace(password); value != "" {
		password, err := normalizePassword(value)
		if err != nil {
			return err
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return commonresponse.InternalServerError("密码加密失败")
		}
		account.PasswordHash = sql.NullString{String: string(hash), Valid: true}
	}

	if allowRole {
		if value := strings.TrimSpace(role); value != "" {
			normalized, err := normalizeRole(value)
			if err != nil {
				return err
			}
			account.Role = normalized
		}
	}

	if allowStatus {
		if value := strings.ToLower(strings.TrimSpace(status)); value != "" {
			switch value {
			case "active", "disabled", "deleted":
				account.Status = value
			default:
				return commonresponse.BadRequest("status 只能是 active、disabled 或 deleted")
			}
		}
	}

	return nil
}
