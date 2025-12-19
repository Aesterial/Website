package main

import (
	login "ascendant/backend/internal/app/auth"
	userinfo "ascendant/backend/internal/app/info/user"
	usermodifier "ascendant/backend/internal/app/modifier/user"
	"ascendant/backend/internal/infra/db"
	dbtest "ascendant/backend/internal/infra/db/test"
	userhandler "ascendant/backend/internal/infra/http/handlers/user"
	"ascendant/backend/internal/infra/http/routes"
	"ascendant/backend/internal/infra/logger"
	"ascendant/backend/internal/shared/config"

	"github.com/gin-gonic/gin"
)

func main() {
	logger.Debug("service starting", "service.starting")
	config.Ensure()
	if err := dbtest.Init(); err != nil {
		logger.Error("Failed to test db: "+err.Error(), "db.start.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	dbConn, err := db.NewConnection()
	if err != nil {
		logger.Error("Failed to connect db: "+err.Error(), "db.connect.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	userRepo := db.NewUserRepository(dbConn)
	userInfoService := userinfo.New(userRepo)
	userModifierService := usermodifier.New(userRepo)
	userHandler := userhandler.New(userInfoService, userModifierService)

	service := gin.New()
	service.POST("/reg", login.Register)
	routes.Register(service, userHandler)
	if config.ENV.Boot.UseTLS {
		if err = service.RunTLS("0.0.0.0"+config.ENV.Boot.Port, config.ENV.TLS.CertPath, config.ENV.TLS.KeyPath); err != nil {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	} else {
		if err = service.Run("0.0.0.0:" + config.ENV.Boot.Port); err != nil {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	}
}
