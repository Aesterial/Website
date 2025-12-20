package handlers

import "github.com/gin-gonic/gin"

func GetTraceID(req *gin.Context) string {
	trace, exists := req.Get("traceID")
	if !exists {
		return ""
	}
	return trace.(string)
}
