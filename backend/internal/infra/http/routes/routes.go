package routes

import (
	userhandler "ascendant/backend/internal/infra/http/handlers/user"

	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine, userHandler *userhandler.Handler) {
	api := r.Group("/api")
	users := api.Group("/users")
	users.GET("/:id", userHandler.GetByID)
	users.PATCH("/:id/name", userHandler.UpdateName)
}
