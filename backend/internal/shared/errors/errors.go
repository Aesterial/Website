package errors

type Error struct {
	Code    string
	Message string
	Details map[string]string
	TraceID string
}

func (e Error) Error() string {
	return e.Code + ": " + e.Message
}

func UserNotFound(uid, traceID string) Error {
	return Error{
		Code:    "UserNotFound",
		Message: "User not found",
		Details: map[string]string{
			"userID": uid,
		},
		TraceID: traceID,
	}
}

func QueryNotFound(query string, traceID string) Error {
	return Error{
		Code:    "QueryNotFound",
		Message: "Query not found",
		Details: map[string]string{
			"query": query,
		},
		TraceID: traceID,
	}
}

func BuildError(code string, message string, details map[string]string, traceID string) Error {
	return Error{
		Code:    code,
		Message: message,
		Details: details,
		TraceID: traceID,
	}
}
