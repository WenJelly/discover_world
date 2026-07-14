package adminsupport

import (
	"context"
	"database/sql"
	accountmodel "discover_world/model/account"
	adminmodel "discover_world/model/admin"
	"encoding/json"
	"strings"
	"unicode/utf8"

	commonauth "discover_world/internal/common/auth"
	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
)

const (
	CapabilityAccountManage   = "admin.account.manage"
	CapabilityMediaReview     = "admin.media.review"
	CapabilityContentModerate = "admin.content.moderate"
	CapabilityOperationManage = "admin.operation.manage"
	CapabilityAuditRead       = "admin.audit.read"

	defaultPageSize = 20
	maxPageSize     = 100
	maxReasonRunes  = 500
)

type OperationLogInput struct {
	OperatorUserID uint64
	Action         string
	TargetType     string
	TargetID       uint64
	Reason         string
	Before         any
	After          any
	Metadata       any
	ClientIP       string
}

func NormalizePage(pageNum, pageSize int64) (int64, int64) {
	if pageNum <= 0 {
		pageNum = 1
	}
	if pageSize <= 0 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}
	return pageNum, pageSize
}

func NormalizeReason(reason string) (string, error) {
	reason = strings.TrimSpace(reason)
	if utf8.RuneCountInString(reason) > maxReasonRunes {
		return "", commonresponse.BadRequest("reason length cannot exceed 500")
	}
	return reason, nil
}

func RequireAdminCapability(ctx context.Context, svcCtx *svc.ServiceContext, capability string) (*accountmodel.UserAccount, error) {
	if svcCtx == nil {
		return nil, commonresponse.Forbidden("无后台权限")
	}
	loginUser, err := commonauth.LoadRequiredLoginUser(ctx, svcCtx, "")
	if err != nil {
		return nil, err
	}
	if svcCtx.IsAdminAccount(loginUser) {
		return loginUser, nil
	}
	capability = strings.TrimSpace(capability)
	if capability == "" || svcCtx.AdminRolePolicyModel == nil {
		return nil, commonresponse.Forbidden("无后台权限")
	}
	ok, err := svcCtx.AdminRolePolicyModel.HasCapability(ctx, strings.TrimSpace(loginUser.Role), capability)
	if err != nil {
		return nil, commonresponse.InternalServerError("查询后台权限失败")
	}
	if !ok {
		return nil, commonresponse.Forbidden("无后台权限")
	}
	return loginUser, nil
}

func BuildAuditSnapshot(value any) (sql.NullString, error) {
	if value == nil {
		return sql.NullString{}, nil
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return sql.NullString{}, err
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return sql.NullString{}, err
	}
	scrubSensitive(decoded)
	cleaned, err := json.Marshal(decoded)
	if err != nil {
		return sql.NullString{}, err
	}
	return sql.NullString{String: string(cleaned), Valid: true}, nil
}

func RecordOperation(ctx context.Context, svcCtx *svc.ServiceContext, input OperationLogInput) error {
	if svcCtx == nil || svcCtx.AdminOperationLogModel == nil {
		return commonresponse.InternalServerError("后台审计日志模型未初始化")
	}
	reason, err := NormalizeReason(input.Reason)
	if err != nil {
		return err
	}
	beforeJSON, err := BuildAuditSnapshot(input.Before)
	if err != nil {
		return commonresponse.InternalServerError("生成操作前快照失败")
	}
	afterJSON, err := BuildAuditSnapshot(input.After)
	if err != nil {
		return commonresponse.InternalServerError("生成操作后快照失败")
	}
	metadataJSON, err := BuildAuditSnapshot(input.Metadata)
	if err != nil {
		return commonresponse.InternalServerError("生成操作元数据失败")
	}

	_, err = svcCtx.AdminOperationLogModel.Insert(ctx, &adminmodel.AdminOperationLog{
		OperatorUserId: input.OperatorUserID,
		Action:         strings.TrimSpace(input.Action),
		TargetType:     strings.TrimSpace(input.TargetType),
		TargetId:       input.TargetID,
		Reason:         sql.NullString{String: reason, Valid: reason != ""},
		BeforeJson:     beforeJSON,
		AfterJson:      afterJSON,
		MetadataJson:   metadataJSON,
		ClientIp:       sql.NullString{String: strings.TrimSpace(input.ClientIP), Valid: strings.TrimSpace(input.ClientIP) != ""},
	})
	if err != nil {
		return commonresponse.InternalServerError("写入后台审计日志失败")
	}
	return nil
}

func scrubSensitive(value any) {
	switch typed := value.(type) {
	case map[string]any:
		for key, child := range typed {
			if isSensitiveAuditKey(key) {
				delete(typed, key)
				continue
			}
			scrubSensitive(child)
		}
	case []any:
		for _, child := range typed {
			scrubSensitive(child)
		}
	}
}

func isSensitiveAuditKey(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	return strings.Contains(key, "password") || strings.Contains(key, "token") || strings.Contains(key, "secret")
}
