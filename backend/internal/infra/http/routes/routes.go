package routes

import (
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/infra/http/handlers/login"
	userhandler "ascendant/backend/internal/infra/http/handlers/user"

	"github.com/gin-gonic/gin"
)

func RegisterUser(userHandler *userhandler.Handler, group *gin.RouterGroup, requirePermissions func(...permissions.Permission) gin.HandlerFunc) {
	group.GET("/api/user", userHandler.GetSelf)
	group.GET("/api/user/:id", requirePermissions(permissions.ViewOtherProfile), userHandler.GetByID)
	group.PATCH("/api/user/name", requirePermissions(permissions.PatchSelfProfile), userHandler.UpdateName)
}

func RegisterLogin(loginHandler *login.Handler, group *gin.RouterGroup) {
	group.POST("/api/login/register", loginHandler.Register)
	group.POST("/api/login/authorization", loginHandler.Authorization)
}
