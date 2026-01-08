package grpcserver

import (
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	"ascendant/backend/internal/app/submissions"
	"ascendant/backend/internal/domain/permissions"
	submpb "ascendant/backend/internal/gen/submissions/v1"
	"context"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type SubmissionsService struct {
	submpb.UnimplementedSubmissionsServiceServer
	submissions *submissions.Service
	auth        *Authenticator
}

func NewSubmissionsService(submissions *submissions.Service, sess *sessionsapp.Service, perms *permissionsapp.Service, us *userapp.Service) *SubmissionsService {
	return &SubmissionsService{
		submissions: submissions,
		auth:        NewAuthenticator(sess, perms, us),
	}
}

func (s *SubmissionsService) Approve(ctx context.Context, req *submpb.ApproveRequest) (*submpb.DataResponse, error) {
	if s == nil || s.submissions == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	if err := s.submissions.Approve(ctx, id); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &submpb.DataResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *SubmissionsService) Decline(ctx context.Context, req *submpb.DeclineRequest) (*submpb.DataResponse, error) {
	if s == nil || s.submissions == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, status.Error(codes.InvalidArgument, err.Error())
	}
	if err := s.submissions.Decline(ctx, id, req.Reason); err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &submpb.DataResponse{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *SubmissionsService) List(ctx context.Context, _ *emptypb.Empty) (*submpb.ListResponse, error) {
	if s == nil || s.submissions == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.BanProfile); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	list, err := s.submissions.GetList(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	return &submpb.ListResponse{Data: list, Tracing: TraceIDOrNew(ctx)}, nil
}
