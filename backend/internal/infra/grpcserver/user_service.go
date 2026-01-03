package grpcserver

import (
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userinfo "ascendant/backend/internal/app/info/user"
	usermodifier "ascendant/backend/internal/app/modifier/user"
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/domain/user"
	userpb "ascendant/backend/internal/gen/user/v1"
	"ascendant/backend/internal/infra/logger"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserService struct {
	userpb.UnimplementedUserServiceServer
	info     *userinfo.Service
	modifier *usermodifier.Service
	sessions *sessionsapp.Service
	auth     *Authenticator
}

func NewUserService(info *userinfo.Service, modifier *usermodifier.Service, sessions *sessionsapp.Service, perms *permissionsapp.Service) *UserService {
	return &UserService{
		info:     info,
		modifier: modifier,
		sessions: sessions,
		auth:     NewAuthenticator(sessions, perms, info),
	}
}

func (s *UserService) Self(ctx context.Context, _ *emptypb.Empty) (*userpb.UserSelfResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	u, err := s.info.GetSelf(ctx, requestor.SessionID)
	if err != nil {
		return nil, statusFromError(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got information about self", "login.authorization.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &userpb.UserSelfResponse{Data: toProtoUserSelf(u), Tracing: traceID}, nil
}

func (s *UserService) Other(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.UserPublicResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.ViewOtherProfile); err != nil {
		return nil, err
	}
	u, err := s.info.GetByID(ctx, uint(req.UserID))
	if err != nil {
		return nil, statusFromError(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info(fmt.Sprintf("Got information about user with id: %d", req.UserID), "login.authorization.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &userpb.UserPublicResponse{Data: toProtoUserPublic(u), Tracing: traceID}, nil
}

func (s *UserService) Sessions(ctx context.Context, _ *emptypb.Empty) (*userpb.UserSessionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if s.sessions == nil {
		return nil, status.Error(codes.Internal, "sessions service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested sessions", "user.sessions.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	list, err := s.sessions.GetSessions(ctx, requestor.UID)
	if err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info("Got sessions", "user.sessions.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &userpb.UserSessionsResponse{Data: toProtoUserSessions(list), Tracing: traceID}, nil
}

func (s *UserService) UpdateSelfName(ctx context.Context, req *userpb.ChangeSelfNameRequest) (*userpb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.PatchSelfProfile); err != nil {
		return nil, err
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	if s.modifier == nil {
		return nil, status.Error(codes.Internal, "modifier service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested self name update", "user.update_self_name.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	if _, err := s.modifier.UpdateName(ctx, requestor.UID, req.Name); err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info("Updated self name", "user.update_self_name.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &userpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *UserService) UpdateSelfAvatar(ctx context.Context, req *userpb.Avatar) (*userpb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.PatchSelfProfile); err != nil {
		return nil, err
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	if s.modifier == nil {
		return nil, status.Error(codes.Internal, "modifier service not configured")
	}
	avatar := fromProtoAvatar(req)
	if avatar == nil || len(avatar.Data) == 0 {
		return nil, status.Error(codes.InvalidArgument, "avatar data is empty")
	}

	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested self avatar update", "user.update_self_avatar.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	if _, err := s.modifier.UpdateAvatar(ctx, requestor.UID, *avatar); err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info("Updated self avatar", "user.update_self_avatar.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &userpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *UserService) Ban(ctx context.Context, req *userpb.BanUserRequest) (*userpb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, err
	}
	err = s.info.Ban(ctx, user.BanInfo{Executor: requestor.UID, Target: uint(req.UserID), Reason: req.Reason, Expire: time.Now().Add(req.Duration.AsDuration())})
	return &userpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, err
}

func (s *UserService) Unban(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, err
	}
	err = s.info.UnBan(ctx, uint(req.UserID))
	return &userpb.EmptyResponse{Tracing: TraceIDOrNew(ctx)}, err
}

func formateBanInfoResponse(ctx context.Context, info *user.BanInfo, srv *userinfo.Service) (*userpb.BanInfoResponse, error) {
	executor, err := srv.GetByID(ctx, info.Executor)
	if err != nil {
		return nil, statusFromError(err)
	}
	var expr *timestamppb.Timestamp
	if info.Expires.Valid {
		expr = timestamppb.New(info.Expires.Time)
	}
	return &userpb.BanInfoResponse{Id: info.ID.String(), Executor: executor.ToPublic(), Reason: info.Reason, At: timestamppb.New(info.At), Expires: expr, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *UserService) BanInfo(ctx context.Context, _ *emptypb.Empty) (*userpb.BanInfoResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil && !(strings.Contains(strings.ToLower(strings.TrimSpace(err.Error())), "user is banned")) {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	info, err := s.info.BanInfo(ctx, requestor.UID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, status.Error(codes.NotFound, "User is not banned")
		}
		return nil, statusFromError(err)
	}

	return formateBanInfoResponse(ctx, info, s.info)
}

func (s *UserService) BanInfoOther(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.BanInfoResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, err
	}
	info, err := s.info.BanInfo(ctx, uint(req.UserID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, status.Error(codes.NotFound, "User is not banned")
		}
		return nil, statusFromError(err)
	}
	return formateBanInfoResponse(ctx, info, s.info)
}

func (s *UserService) Users(ctx context.Context, _ *emptypb.Empty) (*userpb.UsersResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "User not logged in")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.ViewStatistics); err != nil {
		return nil, err
	}
	info, err := s.info.GetList(ctx)
	if err != nil {
		return nil, statusFromError(err)
	}
	return &userpb.UsersResponse{Data: info, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *UserService) DeleteSelfAvatar(ctx context.Context, _ *emptypb.Empty) (*userpb.EmptyResponse, error) {
	return nil, status.Error(codes.Unimplemented, "DeleteSelfAvatar is not implemented")
}

func (s *UserService) DeleteUserAvatar(ctx context.Context, req *userpb.OtherUserRequest) (*userpb.EmptyResponse, error) {
	return nil, status.Error(codes.Unimplemented, "DeleteUserAvatar is not implemented")
}
