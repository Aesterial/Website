package main

import (
	loginapp "ascendant/backend/internal/app/auth"
	"ascendant/backend/internal/app/config"
	permissionsinfo "ascendant/backend/internal/app/info/permissions"
	sessionsinfo "ascendant/backend/internal/app/info/sessions"
	userinfo "ascendant/backend/internal/app/info/user"
	loggerservice "ascendant/backend/internal/app/logger"
	usermodifier "ascendant/backend/internal/app/modifier/user"
	projectsapp "ascendant/backend/internal/app/projects"
	appstatistics "ascendant/backend/internal/app/statistics"
	storageapp "ascendant/backend/internal/app/storage"
	"ascendant/backend/internal/app/submissions"
	loginpb "ascendant/backend/internal/gen/login/v1"
	permspb "ascendant/backend/internal/gen/permissions/v1"
	projpb "ascendant/backend/internal/gen/projects/v1"
	statpb "ascendant/backend/internal/gen/statistics/v1"
	storagepb "ascendant/backend/internal/gen/storage/v1"
	submpb "ascendant/backend/internal/gen/submissions/v1"
	userpb "ascendant/backend/internal/gen/user/v1"
	"ascendant/backend/internal/infra/db"
	dbtest "ascendant/backend/internal/infra/db/test"
	"ascendant/backend/internal/infra/grpcserver"
	"ascendant/backend/internal/infra/logger"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/reflection"
)

func printRegistered(serv *grpc.Server) {
	type row struct {
		svc    string
		method string
	}

	rows := make([]row, 0, 64)
	maxSvc, maxMeth := 0, 0

	for svc, info := range serv.GetServiceInfo() {
		if l := len(svc); l > maxSvc {
			maxSvc = l
		}
		for _, m := range info.Methods {
			rows = append(rows, row{svc: svc, method: m.Name})
			if l := len(m.Name); l > maxMeth {
				maxMeth = l
			}
		}
	}

	sort.Slice(rows, func(i, j int) bool {
		if rows[i].svc == rows[j].svc {
			return rows[i].method < rows[j].method
		}
		return rows[i].svc < rows[j].svc
	})

	for _, r := range rows {
		logger.Debug(
			fmt.Sprintf("Registered handler: %-*s | %-*s", maxSvc, r.svc, maxMeth, r.method),
			"grpc.server.handlers",
		)
	}
}

func main() {
	logger.Debug("service starting", "service.starting")

	env := config.Get()

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
	loginRepo := db.NewLoginRepository(dbConn)
	sessionsRepo := db.NewSessionsRepository(dbConn)
	permissionsRepo := db.NewPermissionsRepository(dbConn)
	statisticsRepo := db.NewStatisticsRepository(dbConn)
	projectsRepo := db.NewProjectsRepository(dbConn)
	submissionsRepo := db.NewSubmissionRepository(dbConn)

	loggerServ := loggerservice.New(loggerRepo)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	loggerServ.Start(ctx, 2*time.Second)

	sessionsService := sessionsinfo.New(sessionsRepo)
	userInfoService := userinfo.New(userRepo, sessionsRepo)
	userModifierService := usermodifier.New(userRepo)
	permissionsService := permissionsinfo.New(permissionsRepo)
	loginService := loginapp.New(loginRepo, sessionsService, userInfoService)
	statService := appstatistics.New(statisticsRepo)
	projectsService := projectsapp.New(projectsRepo)
	submissionService := submissions.New(submissionsRepo, projectsService, userInfoService)
	storageService, err := storageapp.New()
	if err != nil {
		logger.Error("Failed to init storage: "+err.Error(), "service.storage.init", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	loginServer := grpcserver.NewLoginService(loginService, sessionsService, permissionsService, userInfoService)
	userServer := grpcserver.NewUserService(userInfoService, userModifierService, sessionsService, permissionsService, storageService)
	permissionsServer := grpcserver.NewPermissionsService(permissionsService, sessionsService, userInfoService)
	statServer := grpcserver.NewStatService(statService, sessionsService, permissionsService, userInfoService)
	projectServer := grpcserver.NewProjectService(projectsService, sessionsService, permissionsService, userInfoService)
	storageServer := grpcserver.NewStorageService(storageService)
	submissionServer := grpcserver.NewSubmissionsService(submissionService, sessionsService, permissionsService, userInfoService)

	gateway := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(gatewayHeaderMatcher),
		runtime.WithOutgoingHeaderMatcher(gatewayOutgoingHeaderMatcher),
	)
	if err := loginpb.RegisterLoginServiceHandlerServer(ctx, gateway, loginServer); err != nil {
		logger.Error("Failed to register login gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := userpb.RegisterUserServiceHandlerServer(ctx, gateway, userServer); err != nil {
		logger.Error("Failed to register user gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := permspb.RegisterPermissionsServiceHandlerServer(ctx, gateway, permissionsServer); err != nil {
		logger.Error("Failed to register permissions gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := statpb.RegisterStatisticsServiceHandlerServer(ctx, gateway, statServer); err != nil {
		logger.Error("Failed to register statistics gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := projpb.RegisterProjectServiceHandlerServer(ctx, gateway, projectServer); err != nil {
		logger.Error("Failed to register projects gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := storagepb.RegisterStorageHandlerServer(ctx, gateway, storageServer); err != nil {
		logger.Error("Failed to register storage gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := submpb.RegisterSubmissionsServiceHandlerServer(ctx, gateway, submissionServer); err != nil {
		logger.Error("Failed to register submissions storage gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	grpcPort := normalizePort(env.Startup.GRPCPort, env.Startup.Port, "8080")
	httpPort := normalizePort(env.Startup.HTTPPort, env.Startup.Port, grpcPort)
	samePort := grpcPort == httpPort

	var opts []grpc.ServerOption
	if env.TLS.Use && !samePort {
		creds, err := credentials.NewServerTLSFromFile(env.TLS.CertPath, env.TLS.KeyPath)
		if err != nil {
			logger.Error("Failed to load TLS creds: "+err.Error(), "service.tls.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
			return
		}
		opts = append(opts, grpc.Creds(creds))
	}
	opts = append(opts, grpc.UnaryInterceptor(grpcserver.TraceUnaryInterceptor()))

	grpcServer := grpc.NewServer(opts...)
	reflection.Register(grpcServer)
	loginpb.RegisterLoginServiceServer(grpcServer, loginServer)
	userpb.RegisterUserServiceServer(grpcServer, userServer)
	permspb.RegisterPermissionsServiceServer(grpcServer, permissionsServer)
	statpb.RegisterStatisticsServiceServer(grpcServer, statServer)
	projpb.RegisterProjectServiceServer(grpcServer, projectServer)
	storagepb.RegisterStorageServer(grpcServer, storageServer)
	submpb.RegisterSubmissionsServiceServer(grpcServer, submissionServer)

	cors := newCORS(env.Cors.AllowedOrigins)
	handler := buildHTTPHandler(grpcServer, gateway, cors)
	httpAddr := "0.0.0.0:" + httpPort
	grpcAddr := "0.0.0.0:" + grpcPort

	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	printRegistered(grpcServer)

	srvErr := make(chan error, 2)
	if samePort {
		if !env.TLS.Use {
			httpServer.Handler = withH2C(handler)
		}
		go func() {
			logger.Debug("listening on same addr: "+httpServer.Addr, "service.listen.start")
			srvErr <- serveHTTPServer(httpServer, env.TLS.Use, env.TLS.CertPath, env.TLS.KeyPath)
		}()
	} else {
		listener, err := net.Listen("tcp", grpcAddr)
		if err != nil {
			logger.Error("Failed to listen: "+err.Error(), "service.listen.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
			return
		}
		go func() {
			logger.Debug("gRPC serving at: "+grpcAddr, "service.listen.start")
			srvErr <- grpcServer.Serve(listener)
		}()
		go func() {
			logger.Debug("HTTP serving at: "+httpAddr, "service.listen.start")
			srvErr <- serveHTTPServer(httpServer, env.TLS.Use, env.TLS.CertPath, env.TLS.KeyPath)
		}()
	}

	select {
	case <-ctx.Done():
		logger.Debug("shutdown signal received", "service.shutdown.signal")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			logger.Error("Failed to shutdown http server: "+err.Error(), "service.shutdown.failed", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		}

		done := make(chan struct{})
		go func() {
			grpcServer.GracefulStop()
			close(done)
		}()

		select {
		case <-done:
		case <-time.After(10 * time.Second):
			grpcServer.Stop()
		}
		logger.Debug("service stopped", "service.stopped")

	case err = <-srvErr:
		if err != nil && !errors.Is(err, grpc.ErrServerStopped) && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("Service is Down!. "+err.Error(), "service.down", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
		}
	}
}

func normalizePort(values ...string) string {
	for _, raw := range values {
		val := strings.TrimSpace(raw)
		val = strings.TrimPrefix(val, ":")
		if val != "" {
			return val
		}
	}
	return ""
}

func serveHTTPServer(server *http.Server, useTLS bool, certPath, keyPath string) error {
	if useTLS {
		return server.ListenAndServeTLS(certPath, keyPath)
	}
	return server.ListenAndServe()
}
