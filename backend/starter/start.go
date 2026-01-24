package main

import (
	loginapp "Aesterial/backend/internal/app/auth"
	"Aesterial/backend/internal/app/config"
	sessionsinfo "Aesterial/backend/internal/app/info/sessions"
	userinfo "Aesterial/backend/internal/app/info/user"
	loggerservice "Aesterial/backend/internal/app/logger"
	"Aesterial/backend/internal/app/mailer"
	maintenanceapp "Aesterial/backend/internal/app/maintenance"
	usermodifier "Aesterial/backend/internal/app/modifier/user"
	projectsapp "Aesterial/backend/internal/app/projects"
	rankapp "Aesterial/backend/internal/app/rank"
	appstatistics "Aesterial/backend/internal/app/statistics"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/submissions"
	"Aesterial/backend/internal/app/tickets"
	"Aesterial/backend/internal/app/verification"
	checkerpb "Aesterial/backend/internal/gen/checker/v1"
	loginpb "Aesterial/backend/internal/gen/login/v1"
	maintenancepb "Aesterial/backend/internal/gen/maintenance/v1"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	rankpb "Aesterial/backend/internal/gen/ranks/v1"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	storagepb "Aesterial/backend/internal/gen/storage/v1"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	tickpb "Aesterial/backend/internal/gen/tickets/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"Aesterial/backend/internal/infra/db"
	dbtest "Aesterial/backend/internal/infra/db/test"
	"Aesterial/backend/internal/infra/grpcserver"
	"Aesterial/backend/internal/infra/logger"
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
	statisticsRepo := db.NewStatisticsRepository(dbConn)
	projectsRepo := db.NewProjectsRepository(dbConn)
	submissionsRepo := db.NewSubmissionRepository(dbConn)
	verificationRepo := db.NewVerificationRepository(dbConn)
	maintenanceRepo := db.NewMaintenanceRepository(dbConn)
	ticketsRepo := db.NewTicketsRepository(dbConn)
	ranksRepo := db.NewRanksRepository(dbConn)

	loggerServ := loggerservice.New(loggerRepo)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	loggerServ.Start(ctx, 2*time.Second)

	mailerService := mailer.New(mailer.Config{
		Host:     env.Mailer.Host,
		Port:     env.Mailer.Port,
		User:     env.Mailer.User,
		Pass:     env.Mailer.Pass,
		FromName: env.Mailer.FromName,
		Secure:   env.Mailer.Secure,
	})
	sessionsService := sessionsinfo.New(sessionsRepo)
	userInfoService := userinfo.New(userRepo, sessionsRepo)
	userModifierService := usermodifier.New(userRepo)
	loginService := loginapp.New(loginRepo, sessionsService, userInfoService)
	statService := appstatistics.New(statisticsRepo)
	projectsService := projectsapp.New(projectsRepo)
	maintenanceService := maintenanceapp.New(maintenanceRepo)
	submissionService := submissions.New(submissionsRepo, projectsService, userInfoService)
	ticketsService := tickets.New(ticketsRepo, userRepo, mailerService)
	ranksService := rankapp.New(ranksRepo)
	verificationService := verification.New(verificationRepo, mailerService)
	storageService, err := storageapp.New()
	if err != nil {
		logger.Error("Failed to init storage: "+err.Error(), "service.storage.init", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}

	loginServer := grpcserver.NewLoginService(loginService, sessionsService, userInfoService, verificationService, storageService)
	userServer := grpcserver.NewUserService(userInfoService, userModifierService, sessionsService, storageService)
	statServer := grpcserver.NewStatService(statService, sessionsService, userInfoService)
	projectServer := grpcserver.NewProjectService(projectsService, sessionsService, userInfoService, storageService)
	storageServer := grpcserver.NewStorageService(storageService)
	submissionServer := grpcserver.NewSubmissionsService(submissionService, sessionsService, userInfoService, storageService)
	maintenanceServer := grpcserver.NewMaintenanceService(maintenanceService, sessionsService, userInfoService)
	ticketsServer := grpcserver.NewTicketsService(ticketsService, sessionsService, userInfoService)
	ranksServer := grpcserver.NewRanksService(ranksService, sessionsService, userInfoService, storageService)
	healthServer := grpcserver.NewHealthService()

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
	if err := statpb.RegisterStatisticsServiceHandlerServer(ctx, gateway, statServer); err != nil {
		logger.Error("Failed to register statistics gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := projpb.RegisterProjectServiceHandlerServer(ctx, gateway, projectServer); err != nil {
		logger.Error("Failed to register projects gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := storagepb.RegisterStorageServiceHandlerServer(ctx, gateway, storageServer); err != nil {
		logger.Error("Failed to register storage gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := rankpb.RegisterRanksServiceHandlerServer(ctx, gateway, ranksServer); err != nil {
		logger.Error("Failed to register ranks gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := submpb.RegisterSubmissionsServiceHandlerServer(ctx, gateway, submissionServer); err != nil {
		logger.Error("Failed to register submissions gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := maintenancepb.RegisterMaintenanceServiceHandlerServer(ctx, gateway, maintenanceServer); err != nil {
		logger.Error("Failed to register maintenance gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := tickpb.RegisterTicketsServiceHandlerServer(ctx, gateway, ticketsServer); err != nil {
		logger.Error("Failed to register tickets gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		return
	}
	if err := checkerpb.RegisterCheckerServiceHandlerServer(ctx, gateway, healthServer); err != nil {
		logger.Error("Failed to register health gateway: "+err.Error(), "service.gateway.register", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
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
	statpb.RegisterStatisticsServiceServer(grpcServer, statServer)
	projpb.RegisterProjectServiceServer(grpcServer, projectServer)
	storagepb.RegisterStorageServiceServer(grpcServer, storageServer)
	rankpb.RegisterRanksServiceServer(grpcServer, ranksServer)
	submpb.RegisterSubmissionsServiceServer(grpcServer, submissionServer)
	maintenancepb.RegisterMaintenanceServiceServer(grpcServer, maintenanceServer)
	tickpb.RegisterTicketsServiceServer(grpcServer, ticketsServer)
	checkerpb.RegisterCheckerServiceServer(grpcServer, healthServer)

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
