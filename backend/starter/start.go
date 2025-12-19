package main

import (
	login "ascendant/backend/internal/app/auth"
	dbtest "ascendant/backend/internal/infra/db/test"
	"ascendant/backend/internal/infra/logger"
	"ascendant/backend/internal/shared/config"
)
import "github.com/gin-gonic/gin"

func main() {
	logger.Debug("service starting", "service.starting")
	config.Ensure()
	if err := dbtest.Init(); err != nil {
		logger.Error("Failed to test db: "+err.Error(), "db.start.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	service := gin.New()
	service.POST("/reg", login.Register)
	if config.ENV.Boot.UseTLS {
		if err := service.RunTLS("0.0.0.0"+config.ENV.Boot.Port, config.ENV.TLS.CertPath, config.ENV.TLS.KeyPath); err != nil {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	} else {
		if err := service.Run("0.0.0.0:" + config.ENV.Boot.Port); err != nil {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	}
}
