package response

import "errors"

type statusCoder interface {
	StatusCode() int
}

type codeGetter interface {
	Code() int
}

type StatusError struct {
	resultCode ResultCode
	message    string
}

func (e *StatusError) Error() string {
	return e.Message()
}

func (e *StatusError) StatusCode() int {
	return e.resultCode.StatusCode()
}

func (e *StatusError) Code() int {
	return e.resultCode.Code()
}

func (e *StatusError) Message() string {
	if e.message != "" {
		return e.message
	}

	return e.resultCode.Message()
}

func NewError(resultCode ResultCode, message string) error {
	return &StatusError{
		resultCode: resultCode,
		message:    message,
	}
}

func BadRequest(message string) error {
	return NewError(BadRequestCode, message)
}

func Unauthorized(message string) error {
	return NewError(UnauthorizedCode, message)
}

func Forbidden(message string) error {
	return NewError(ForbiddenCode, message)
}

func NotFound(message string) error {
	return NewError(NotFoundCode, message)
}

func Conflict(message string) error {
	return NewError(ConflictCode, message)
}

func InternalServerError(message string) error {
	return NewError(InternalServerErrorCode, message)
}

func StatusCodeFromError(err error) int {
	if err == nil {
		return 0
	}

	var coder statusCoder
	if errors.As(err, &coder) {
		return coder.StatusCode()
	}

	return InternalServerErrorCode.StatusCode()
}

func CodeFromError(err error) int {
	if err == nil {
		return 0
	}

	var coder codeGetter
	if errors.As(err, &coder) {
		return coder.Code()
	}

	return InternalServerErrorCode.Code()
}

func MessageFromError(err error) string {
	if err == nil {
		return ""
	}

	var publicError *StatusError
	if errors.As(err, &publicError) {
		return publicError.Message()
	}

	return InternalServerErrorCode.Message()
}

func ErrorBody(err error) (int, Body) {
	statusCode := StatusCodeFromError(err)

	return statusCode, Body{
		Code:    CodeFromError(err),
		Message: MessageFromError(err),
	}
}
