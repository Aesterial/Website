package main

import (
	"context"
	"errors"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"Aesterial/backend/mailproxy/internal/app/config"
	"Aesterial/backend/mailproxy/internal/app/mailer"
	mailproxysvc "Aesterial/backend/mailproxy/internal/app/mailproxy"
	mailproxyv1 "Aesterial/backend/mailproxy/internal/gen/proto/mailproxy/v1"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
)

func main() {
	if err := run(); err != nil {
		log.Printf("fatal error: %v", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	mailerService, err := mailer.New(mailer.Config{
		Host:        cfg.SMTP.Host,
		Port:        cfg.SMTP.Port,
		User:        cfg.SMTP.User,
		Pass:        cfg.SMTP.Pass,
		FromName:    cfg.SMTP.FromName,
		FromEmail:   cfg.SMTP.FromEmail,
		ReplyTo:     cfg.SMTP.ReplyTo,
		Secure:      cfg.SMTP.Secure,
		StartTLS:    cfg.SMTP.StartTLS,
		DialTimeout: cfg.SMTP.DialTimeout,
		SendTimeout: cfg.SMTP.SendTimeout,
	})
	if err != nil {
		return err
	}

	lis, err := net.Listen("tcp", cfg.GRPC.Addr)
	if err != nil {
		return err
	}

	grpcServer := grpc.NewServer()
	mailproxyv1.RegisterMailProxyServiceServer(grpcServer, mailproxysvc.NewService(mailerService))

	healthServer := health.NewServer()
	healthpb.RegisterHealthServer(grpcServer, healthServer)
	healthServer.SetServingStatus("", healthpb.HealthCheckResponse_SERVING)
	healthServer.SetServingStatus(mailproxyv1.MailProxyService_ServiceDesc.ServiceName, healthpb.HealthCheckResponse_SERVING)

	stopCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		<-stopCtx.Done()
		log.Println("shutdown signal received")

		healthServer.SetServingStatus("", healthpb.HealthCheckResponse_NOT_SERVING)
		healthServer.SetServingStatus(mailproxyv1.MailProxyService_ServiceDesc.ServiceName, healthpb.HealthCheckResponse_NOT_SERVING)

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
	}()

	log.Printf("mail proxy gRPC server listening on %s", cfg.GRPC.Addr)

	if err := grpcServer.Serve(lis); err != nil && !errors.Is(err, grpc.ErrServerStopped) {
		return err
	}

	return nil
}
