package response

import "net/http"

type ResultCode struct {
	code       int
	message    string
	statusCode int
}

func (c ResultCode) Code() int {
	return c.code
}

func (c ResultCode) Message() string {
	return c.message
}

func (c ResultCode) StatusCode() int {
	if c.statusCode != 0 {
		return c.statusCode
	}

	return c.code
}

var (
	SuccessCode             = ResultCode{code: http.StatusOK, message: "成功", statusCode: http.StatusOK}
	BadRequestCode          = ResultCode{code: http.StatusBadRequest, message: "请求参数错误", statusCode: http.StatusBadRequest}
	UnauthorizedCode        = ResultCode{code: http.StatusUnauthorized, message: "未授权", statusCode: http.StatusUnauthorized}
	ForbiddenCode           = ResultCode{code: http.StatusForbidden, message: "禁止访问", statusCode: http.StatusForbidden}
	NotFoundCode            = ResultCode{code: http.StatusNotFound, message: "资源不存在", statusCode: http.StatusNotFound}
	ConflictCode            = ResultCode{code: http.StatusConflict, message: "资源冲突", statusCode: http.StatusConflict}
	TooManyRequestsCode     = ResultCode{code: http.StatusTooManyRequests, message: "请求过于频繁", statusCode: http.StatusTooManyRequests}
	InternalServerErrorCode = ResultCode{code: http.StatusInternalServerError, message: "服务器异常", statusCode: http.StatusInternalServerError}
)
