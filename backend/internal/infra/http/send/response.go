package send

import (
	"ascendant/backend/internal/shared/errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type ErrorResponse struct {
	Error interface{} `json:"error"`
}

func OK(ctx *gin.Context, data interface{}) {
	ctx.JSON(http.StatusOK, data)
}

func Error(ctx *gin.Context, status int, err error) {
	if err == nil {
		ctx.JSON(status, ErrorResponse{Error: nil})
		return
	}

	if appErr, ok := err.(errors.Error); ok {
		ctx.JSON(status, ErrorResponse{Error: appErr})
		return
	}

	if appErr, ok := err.(*errors.Error); ok {
		ctx.JSON(status, ErrorResponse{Error: appErr})
		return
	}

	ctx.JSON(status, ErrorResponse{Error: gin.H{"message": err.Error()}})
}
