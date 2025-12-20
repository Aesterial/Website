package main

import (
	login "ascendant/backend/internal/app/auth"
	userinfo "ascendant/backend/internal/app/info/user"
	loggerservice "ascendant/backend/internal/app/logger"
	usermodifier "ascendant/backend/internal/app/modifier/user"
	"ascendant/backend/internal/infra/db"
	dbtest "ascendant/backend/internal/infra/db/test"
	userhandler "ascendant/backend/internal/infra/http/handlers/user"
	"ascendant/backend/internal/infra/http/middlewares"
	"ascendant/backend/internal/infra/http/routes"
	"ascendant/backend/internal/infra/logger"
	"ascendant/backend/internal/shared/config"
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	logger.Debug("service starting", "service.starting")

	config.Ensure()

	dbConn, err := db.NewConnection()
	if err != nil {
		logger.Error("Failed to connect db: "+err.Error(), "db.connect.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	if err = dbtest.Init(dbConn); err != nil {
		logger.Error("Failed to test db: "+err.Error(), "db.start.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	defer func() {
		type closer interface{ Close() error }
		if c, ok := any(dbConn).(closer); ok {
			if err = c.Close(); err != nil {
				logger.Error("Failed to close db: "+err.Error(), "db.close.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
			}
		}
	}()

	userRepo := db.NewUserRepository(dbConn)
	loggerRepo := db.NewLoggerRepository(dbConn)
	loggerServ := loggerservice.New(loggerRepo)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	loggerServ.Start(ctx, 2*time.Second)

	userInfoService := userinfo.New(userRepo)
	userModifierService := usermodifier.New(userRepo)
	userHandler := userhandler.New(userInfoService, userModifierService)

	service := gin.New()
	service.Use(middlewares.Tracing())
	service.POST("/reg", login.Register)
	routes.RegisterUser(service, userHandler)

	addr := "0.0.0.0:" + strings.TrimPrefix(config.ENV.Boot.Port, ":")

	srv := &http.Server{
		Addr:              addr,
		Handler:           service,
		ReadHeaderTimeout: 5 * time.Second,
	}

	srvErr := make(chan error, 1)

	go func() {
		if config.ENV.Boot.UseTLS {
			srvErr <- srv.ListenAndServeTLS(config.ENV.TLS.CertPath, config.ENV.TLS.KeyPath)
			return
		}
		srvErr <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		logger.Debug("shutdown signal received", "service.shutdown.signal")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			logger.Error("Failed to shutdown server: "+err.Error(), "service.shutdown.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
			_ = srv.Close()
		}

		logger.Debug("service stopped", "service.stopped")

	case err = <-srvErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	}
}
