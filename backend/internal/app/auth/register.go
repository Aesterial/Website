package login

import (
	"ascendant/backend/internal/infra/http/handlers"
	"ascendant/backend/internal/infra/logger"

	"github.com/gin-gonic/gin"
)

func Register(req *gin.Context) {
	// Just Test
	// Need an implementation to register with that data:
	logger.Info("Successfully registered test user", "service.user.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Success, handlers.GetTraceID(req))
}
