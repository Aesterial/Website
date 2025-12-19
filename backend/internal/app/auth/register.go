package login

import (
	"ascendant/backend/internal/domain/user"
	"ascendant/backend/internal/infra/logger"
	memoryrepo "ascendant/backend/internal/infra/user/memory"
	"net/http"

	"github.com/gin-gonic/gin"
)

func Register(req *gin.Context) {
	// Just Test
	// Need an implementation to register with that data:
	var repo user.Repository = memoryrepo.NewUserRepository()
	if err := repo.Register(req.Request.Context(), user.User{Username: "admin", Email: &user.Email{Address: "some_address@example.com"}, Settings: &user.Settings{Password: "some password without crypt"}}); err != nil {
		logger.Error("Error on Register: "+err.Error(), "service.user.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		req.AbortWithStatus(http.StatusInternalServerError)
	}
	logger.Info("Successfully registered test user", "service.user.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Success)
}
