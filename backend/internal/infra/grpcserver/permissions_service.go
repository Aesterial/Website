package grpcserver

import (
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	"ascendant/backend/internal/domain/permissions"
	permspb "ascendant/backend/internal/gen/permissions/v1"
	"ascendant/backend/internal/infra/logger"
	"context"
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type PermissionsService struct {
	permspb.UnimplementedPermissionsServiceServer
	permissions *permissionsapp.Service
	auth        *Authenticator
}

func NewPermissionsService(perms *permissionsapp.Service, sessions *sessionsapp.Service, us *userapp.Service) *PermissionsService {
	return &PermissionsService{
		permissions: perms,
		auth:        NewAuthenticator(sessions, perms, us),
	}
}

func (s *PermissionsService) Get(ctx context.Context, _ *emptypb.Empty) (*permspb.PermissionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if s.permissions == nil {
		return nil, status.Error(codes.Internal, "permissions service not configured")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info("Requested own permissions", "permissions.get.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	perms, err := s.permissions.GetForUser(ctx, requestor.UID)
	if err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info("Got own permissions", "permissions.get.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &permspb.PermissionsResponse{Data: toProtoPermissions(perms), Tracing: traceID}, nil
}

func (s *PermissionsService) ForUser(ctx context.Context, req *permspb.RequestForUser) (*permspb.PermissionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	if s.permissions == nil {
		return nil, status.Error(codes.Internal, "permissions service not configured")
	}
	if err := s.auth.RequireViewPermissions(ctx, requestor.UID); err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info(fmt.Sprintf("Requested permissions for user with id: %d", req.UserID), "permissions.for_user.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	perms, err := s.permissions.GetForUser(ctx, uint(req.UserID))
	if err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info(fmt.Sprintf("Got permissions for user with id: %d", req.UserID), "permissions.for_user.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &permspb.PermissionsResponse{Data: toProtoPermissions(perms), Tracing: traceID}, nil
}

func (s *PermissionsService) ForRank(ctx context.Context, req *permspb.RequestForRank) (*permspb.PermissionsResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	if s.permissions == nil {
		return nil, status.Error(codes.Internal, "permissions service not configured")
	}
	if err := s.auth.RequireViewPermissions(ctx, requestor.UID); err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info(fmt.Sprintf("Requested permissions for rank: %s", req.Name), "permissions.for_rank.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	perms, err := s.permissions.GetForRank(ctx, req.Name)
	if err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info(fmt.Sprintf("Got permissions for rank: %s", req.Name), "permissions.for_rank.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &permspb.PermissionsResponse{Data: toProtoPermissions(perms), Tracing: traceID}, nil
}

func (s *PermissionsService) ChangeForUser(ctx context.Context, req *permspb.RequestForUserChange) (*permspb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if s.permissions == nil {
		return nil, status.Error(codes.Internal, "permissions service not configured")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.ManagePermissions); err != nil {
		return nil, err
	}
	if req == nil || req.Permissions == nil {
		return nil, status.Error(codes.InvalidArgument, "permissions is required")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info(fmt.Sprintf("Requested permissions change for user with id: %d", req.UserID), "permissions.change_for_user.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	current, err := s.permissions.GetForUser(ctx, uint(req.UserID))
	if err != nil {
		return nil, statusFromError(err)
	}
	merged := mergePermissions(current, req.Permissions)
	if err := s.permissions.SetForUser(ctx, uint(req.UserID), merged); err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info(fmt.Sprintf("Changed permissions for user with id: %d", req.UserID), "permissions.change_for_user.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &permspb.EmptyResponse{Tracing: traceID}, nil
}

func (s *PermissionsService) ChangeForRank(ctx context.Context, req *permspb.RequestForRankChange) (*permspb.EmptyResponse, error) {
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if s.permissions == nil {
		return nil, status.Error(codes.Internal, "permissions service not configured")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.ManagePermissions); err != nil {
		return nil, err
	}
	if req == nil || req.Permissions == nil {
		return nil, status.Error(codes.InvalidArgument, "permissions is required")
	}
	traceID := TraceIDOrNew(ctx)
	if requestor != nil {
		logger.Info(fmt.Sprintf("Requested permissions change for rank: %s", req.Name), "permissions.change_for_rank.request", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, traceID)
	}
	current, err := s.permissions.GetForRank(ctx, req.Name)
	if err != nil {
		return nil, statusFromError(err)
	}
	merged := mergePermissions(current, req.Permissions)
	if err := s.permissions.SetForRank(ctx, req.Name, merged); err != nil {
		return nil, statusFromError(err)
	}
	if requestor != nil {
		logger.Info(fmt.Sprintf("Changed permissions for rank: %s", req.Name), "permissions.change_for_rank.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	}
	return &permspb.EmptyResponse{Tracing: traceID}, nil
}
