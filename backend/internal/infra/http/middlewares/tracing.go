package middlewares

import (
	"ascendant/backend/internal/infra/logger"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func Tracing() gin.HandlerFunc {
	return func(req *gin.Context) {
		at := time.Now()

		id, err := uuid.NewRandom()
		if err != nil {
			logger.Error("Failed to generate traceID. "+err.Error(),
				"middleware.tracing",
				logger.EventActor{Type: logger.System, ID: 0},
				logger.None,
			)
			req.AbortWithStatus(http.StatusInternalServerError)
			return
		}

		req.Set("traceID", id.String())
		logger.Info("Received new request: "+req.ClientIP()+" -> "+req.FullPath(),
			"middleware.tracing",
			logger.EventActor{Type: logger.System, ID: 0},
			logger.None,
			id.String(),
		)

		req.Next()

		duration := time.Since(at)
		status := req.Writer.Status()

		result := logger.None
		switch {
		case status >= 200 && status < 300:
			result = logger.Success
		case status >= 400:
			result = logger.Failure
		default:
			result = logger.None
		}

		logger.Info(
			fmt.Sprintf("Response to %s from %s: code %d, method %s, elapsed %s",
				req.ClientIP(), req.FullPath(), status, req.Request.Method, duration,
			),
			"middleware.tracing",
			logger.EventActor{Type: logger.System, ID: 0},
			result,
			id.String(),
		)
	}
}
