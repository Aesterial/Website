package grpcserver

import (
	loginapp "ascendant/backend/internal/app/auth"
	"ascendant/backend/internal/app/info/permissions"
	"ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	logindomain "ascendant/backend/internal/domain/login"
	loginpb "ascendant/backend/internal/gen/login/v1"
	"ascendant/backend/internal/infra/logger"
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type LoginService struct {
	loginpb.UnimplementedLoginServiceServer
	login *loginapp.Service
	auth  *Authenticator
}

func NewLoginService(login *loginapp.Service, ses *sessions.Service, perms *permissions.Service, us *userapp.Service) *LoginService {
	return &LoginService{login: login, auth: NewAuthenticator(ses, perms, us)}
}

func (s *LoginService) Authorization(ctx context.Context, req *loginpb.AuthRequest) (*loginpb.AuthResponse, error) {
	if s == nil || s.login == nil {
		return nil, status.Error(codes.Internal, "login service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}

	usermail := strings.TrimSpace(req.Usermail)
	if usermail == "" {
		usermail = strings.TrimSpace(req.Usermail)
	}

	require := logindomain.AuthorizationRequire{
		Usermail: usermail,
		Password: req.Password,
	}

	uid, err := s.login.Authorization(ctx, require)
	if err != nil {
		return nil, statusFromError(err)
	}
	if uid == nil {
		return nil, status.Error(codes.Internal, "missing user id")
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		return nil, statusFromError(err)
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Successfully authorized", "login.authorization.success", logger.EventActor{Type: logger.User, ID: *uid}, logger.Success, traceID)
	return &loginpb.AuthResponse{Data: "success", Tracing: traceID}, nil
}

func (s *LoginService) Register(ctx context.Context, req *loginpb.RegisterRequest) (*loginpb.RegisterResponse, error) {
	if s == nil || s.login == nil {
		return nil, status.Error(codes.Internal, "login service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}

	require := logindomain.RegisterRequire{
		Username: strings.TrimSpace(req.Username),
		Email:    strings.TrimSpace(req.Email),
		Password: req.Password,
	}

	uid, err := s.login.Register(ctx, require)
	if err != nil {
		return nil, statusFromError(err)
	}
	if uid == nil {
		return nil, status.Error(codes.Internal, "missing user id")
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		return nil, statusFromError(err)
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Successfully registered", "login.authorization.success", logger.EventActor{Type: logger.User, ID: *uid}, logger.Success, traceID)
	return &loginpb.RegisterResponse{Data: "success", Tracing: traceID}, nil
}

func (s *LoginService) Logout(ctx context.Context, _ *emptypb.Empty) (*loginpb.EmptyResponse, error) {
	if s == nil || s.login == nil {
		return nil, status.Error(codes.Internal, "login service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	if err = s.login.Logout(ctx, requestor.SessionID); err != nil {
		return nil, statusFromError(err)
	}
	return &loginpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *LoginService) issueAndStoreSession(ctx context.Context, uid uint) error {
	if s.login.Sessions == nil || s.login.User == nil {
		return errors.New("login dependencies are missing")
	}

	live, err := s.login.User.GetUserSessionLiveTime(ctx, uid)
	if err != nil {
		return err
	}

	ttl := 7 * 24 * time.Hour
	if live != nil && live.Duration > 0 {
		ttl = live.Duration
	}

	sessionID := uuid.New()
	token, err := issueSessionToken(sessionID.String(), ttl)
	if err != nil {
		return err
	}

	if err := setSessionCookieHeader(ctx, token, ttl); err != nil {
		return err
	}

	agentHash := userAgentHash(ctx)
	if agentHash == "" {
		agentHash = "unknown"
	}

	return s.login.Sessions.AddSession(
		ctx,
		sessionID,
		agentHash,
		time.Now().Add(ttl),
		uid,
	)
}
