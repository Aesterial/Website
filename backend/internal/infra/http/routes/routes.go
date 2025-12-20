package routes

import (
	"ascendant/backend/internal/infra/http/handlers/login"
	userhandler "ascendant/backend/internal/infra/http/handlers/user"

	"github.com/gin-gonic/gin"
)

func RegisterUser(r *gin.Engine, userHandler *userhandler.Handler) {
	api := r.Group("/api")
	users := api.Group("/users")
	users.GET("/:id", userHandler.GetByID)
	users.PATCH("/:id/name", userHandler.UpdateName)
}

func RegisterLogin(r *gin.Engine, loginHandler *login.Handler) {
	api := r.Group("/api")
	login := api.Group("/login")
	login.POST("/register", loginHandler.Register)
	login.POST("/authorization", loginHandler.Authorization)
}
