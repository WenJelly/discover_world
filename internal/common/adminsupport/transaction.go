package adminsupport

import (
	"context"

	commonresponse "discover_world/internal/common/response"
	"discover_world/internal/svc"
)

type operationTransaction func(context.Context, func(context.Context, *svc.ServiceContext) error) error
type operationStep func(context.Context, *svc.ServiceContext) error

// TransactOperation keeps a governance mutation and its mandatory audit row in
// the same database transaction. An audit failure therefore rolls back the
// business mutation instead of returning a misleading partial failure.
func TransactOperation(ctx context.Context, svcCtx *svc.ServiceContext, input OperationLogInput, mutate operationStep) error {
	if svcCtx == nil {
		return commonresponse.InternalServerError("后台事务服务未初始化")
	}
	return transactOperation(ctx, svcCtx.Transact, mutate, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		return RecordOperation(ctx, txSvcCtx, input)
	})
}

func transactOperation(ctx context.Context, transact operationTransaction, mutate, audit operationStep) error {
	if transact == nil || mutate == nil || audit == nil {
		return commonresponse.InternalServerError("后台事务操作未初始化")
	}
	return transact(ctx, func(ctx context.Context, txSvcCtx *svc.ServiceContext) error {
		if err := mutate(ctx, txSvcCtx); err != nil {
			return err
		}
		return audit(ctx, txSvcCtx)
	})
}
