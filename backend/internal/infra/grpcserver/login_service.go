package grpcserver

import (
	loginapp "Aesterial/backend/internal/app/auth"
	"Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/verification"
	logindomain "Aesterial/backend/internal/domain/login"
	verdomain "Aesterial/backend/internal/domain/verification"
	loginpb "Aesterial/backend/internal/gen/login/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/emptypb"
)

type LoginService struct {
	loginpb.UnimplementedLoginServiceServer
	login        *loginapp.Service
	auth         *Authenticator
	verification *verification.Service
	storage      *storageapp.Service
}

func NewLoginService(login *loginapp.Service, ses *sessions.Service, us *userapp.Service, ver *verification.Service, storage *storageapp.Service) *LoginService {
	return &LoginService{login: login, auth: NewAuthenticator(ses, us), verification: ver, storage: storage}
}

func (s *LoginService) Authorization(ctx context.Context, req *loginpb.AuthRequest) (*loginpb.AuthResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("login service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
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
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			return nil, apperrors.Unauthenticated
		}
		return nil, apperrors.Wrap(err)
	}
	if uid == nil {
		return nil, apperrors.ServerError.AddErrDetails("uid is empty")
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to register session: " + err.Error())
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Successfully authorized", "login.authorization.success", logger.EventActor{Type: logger.User, ID: *uid}, logger.Success, traceID)
	return &loginpb.AuthResponse{Data: "success", Tracing: traceID}, nil
}

func (s *LoginService) Register(ctx context.Context, req *loginpb.RegisterRequest) (*loginpb.RegisterResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("login service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}

	require := logindomain.RegisterRequire{
		Username: strings.TrimSpace(req.Username),
		Email:    strings.TrimSpace(req.Email),
		Password: req.Password,
	}

	uid, err := s.login.Register(ctx, require)
	if err != nil {
		if errorContains(err, "duplicate key value violates unique") {
			return nil, apperrors.AlreadyExists
		}
		return nil, apperrors.Wrap(err)
	}
	if uid == nil {
		return nil, apperrors.ServerError.AddErrDetails("uid is empty")
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to register session: " + err.Error())
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Successfully registered", "login.authorization.success", logger.EventActor{Type: logger.User, ID: *uid}, logger.Success, traceID)
	return &loginpb.RegisterResponse{Data: "success", Tracing: traceID}, nil
}

func (s *LoginService) Logout(ctx context.Context, _ *emptypb.Empty) (*loginpb.EmptyResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	if err = s.login.Logout(ctx, requestor.SessionID); err != nil {
		return nil, apperrors.Wrap(err)
	}
	logger.Info("Logged out", "login.logout.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &loginpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *LoginService) ResetPasswordStart(ctx context.Context, req *loginpb.WithEmailRequest) (*loginpb.EmptyResponse, error) {
	if s == nil || s.verification == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("verification service is not configured")
	}
	if s.verification.Mailer == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
	}
	email := strings.TrimSpace(req.GetEmail())
	if email == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	exists, err := s.verification.EmailExists(ctx, email)
	if err != nil {
		logger.Debug("failed to check exists: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("error: " + err.Error())
	}
	if !exists {
		return nil, apperrors.RecordNotFound
	}
	banned, err := s.verification.IsBanned(ctx, email)
	if err != nil {
		logger.Debug("error while getting banned state: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("internal error")
	}
	if banned {
		return nil, apperrors.AccessDenied.AddErrDetails("email is banned")
	}
	// ip, exists := clientIP(ctx)
	// if !exists {
	// 	logger.Debug("ip not found, returning", "")
	// 	return nil, apperrors.InvalidArguments.AddErrDetails("ip not found")
	// }
	token, err := s.verification.Create(ctx, email, verdomain.PasswordReset, "127.0.0.1", userAgentHash(ctx), 5*time.Minute)
	if err != nil {
		logger.Debug("failed to create verification record: "+err.Error(), "")
		return nil, err
	}
	_, err = s.verification.Mailer.SendPasswordReset(ctx, email, token)
	if err != nil {
		logger.Debug("failed to send mail message: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) VerifyEmailStart(ctx context.Context, _ *emptypb.Empty) (*loginpb.EmptyResponse, error) {
	if s == nil || s.verification == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("verification service is not configured")
	}
	if s.verification.Mailer == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated
	}
	emailST, err := s.login.User.GetEmail(ctx, requestor.UID)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if emailST == nil {
		return nil, apperrors.RecordNotFound
	}
	email := emailST.Address
	banned, err := s.verification.IsBanned(ctx, email)
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("internal error")
	}
	if banned {
		return nil, apperrors.AccessDenied.AddErrDetails("email is banned")
	}
	ip := clientIP(ctx)
	if ip == "unknown" {
		ip = "127.0.0.1"
	}
	token, err := s.verification.Create(ctx, email, verdomain.EmailVerification, ip, userAgentHash(ctx), 5*time.Minute)
	if err != nil {
		logger.Debug("Error while creating verification record: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	_, err = s.verification.Mailer.SendEmailVerify(ctx, email, token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) VerifyEmail(ctx context.Context, req *loginpb.VerifyEmailRequest) (*loginpb.EmptyResponse, error) {
	if s == nil || s.verification == nil || s.login == nil || s.login.User == nil {
		return nil, apperrors.NotConfigured
	}
	email := strings.TrimSpace(req.GetEmail())
	token := strings.TrimSpace(req.GetToken())
	if email == "" || token == "" {
		return nil, apperrors.InvalidArguments
	}
	record, err := s.verification.GetRecord(ctx, verdomain.EmailVerification, token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !strings.EqualFold(record.Email, email) {
		return nil, apperrors.InvalidArguments
	}
	if record.UsedAt != nil {
		return nil, apperrors.InvalidArguments
	}
	if time.Now().After(record.ExpiresAt) {
		return nil, apperrors.InvalidArguments.AddErrDetails("Token Expired")
	}
	if err := s.login.User.SetEmailVerifiedByAddress(ctx, email, true); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if _, err := s.verification.Consume(ctx, verdomain.EmailVerification, token); err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) ResetPassword(ctx context.Context, req *loginpb.ResetPasswordRequest) (*loginpb.EmptyResponse, error) {
	if s == nil || s.verification == nil || s.login == nil || s.login.User == nil {
		return nil, apperrors.NotConfigured
	}
	email := strings.TrimSpace(req.GetEmail())
	token := strings.TrimSpace(req.GetToken())
	if email == "" || token == "" || req.GetPassword() == "" {
		return nil, apperrors.InvalidArguments
	}
	record, err := s.verification.GetRecord(ctx, verdomain.PasswordReset, token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !strings.EqualFold(record.Email, email) {
		return nil, apperrors.ParamsNotMatch
	}
	if record.UsedAt != nil {
		return nil, apperrors.AlreadyUsed
	}
	if time.Now().After(record.ExpiresAt) {
		return nil, apperrors.DataExpired
	}
	hash, err := loginapp.GeneratePassword(req.GetPassword())
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if err := s.login.User.UpdatePasswordByEmail(ctx, email, hash); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if _, err := s.verification.Consume(ctx, verdomain.PasswordReset, token); err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) SetupTOTP(ctx context.Context, _ *emptypb.Empty) (*loginpb.SetupTOTPResponse, error) {
	if s.login == nil || s == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated
	}
	data, err := s.login.SetupTOTP(ctx, requestor.UID)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if err := s.login.Sessions.SetMFACompleted(ctx, requestor.SessionID); err != nil {
		logger.Debug("failed to set mfa completed: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.SetupTOTPResponse{Qr: data.QR, Url: data.URL, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) ConfirmTOTP(ctx context.Context, req *loginpb.ConfirmTOTPRequest) (*loginpb.ConfirmTOTPResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated
	}
	if req == nil || req.GetCode() == "" {
		return nil, apperrors.InvalidArguments
	}
	done, codes, err := s.login.ConfirmTOTP(ctx, requestor.UID, req.GetCode())
	if err != nil {
		logger.Debug("received error: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	if !done {
		return nil, apperrors.InvalidArguments
	}
	if err := s.login.Sessions.SetMFACompleted(ctx, requestor.SessionID); err != nil {
		logger.Debug("failed to set mfa completed: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.ConfirmTOTPResponse{Enabled: true, Recovery: codes, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) Reset2FARecovery(ctx context.Context, req *loginpb.Reset2FARecoveryRequest) (*loginpb.EmptyResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		logger.Debug("failed to auth", "")
		return nil, err
	}
	if requestor == nil {
		logger.Debug("requestor is nil", "")
		return nil, apperrors.Unauthenticated
	}
	if req == nil || req.GetCode() == "" {
		logger.Debug("req is null", "")
		return nil, apperrors.InvalidArguments
	}
	done, err := s.login.ResetTOTPRecovery(ctx, requestor.UID, req.GetCode())
	if err != nil {
		logger.Debug("failed to reset totp: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	if !done {
		logger.Debug("work of reset totp not done", "")
		return nil, apperrors.InvalidArguments
	}
	if err := s.login.Sessions.ResetMFAs(ctx, requestor.UID); err != nil {
		logger.Debug("failed to reset mfa's: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *LoginService) CheckTOTP(ctx context.Context, req *loginpb.ConfirmTOTPRequest) (*loginpb.CheckTOTPResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated
	}
	if req == nil || req.GetCode() == "" {
		logger.Debug("req is null", "")
		return nil, apperrors.InvalidArguments
	}
	correct, err := s.login.CheckTOTP(ctx, requestor.UID, req.GetCode())
	if err != nil {
		logger.Debug("error on checking totp code: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	if !correct {
		return nil, apperrors.InvalidArguments
	}
	if err := s.login.Sessions.SetMFACompleted(ctx, requestor.SessionID); err != nil {
		logger.Debug("failed to set mfa completed: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &loginpb.CheckTOTPResponse{Success: true, Tracing: TraceIDOrNew(ctx)}, nil
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
