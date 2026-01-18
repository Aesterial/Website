package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/submissions"
	"Aesterial/backend/internal/domain/permissions"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type SubmissionsService struct {
	submpb.UnimplementedSubmissionsServiceServer
	submissions *submissions.Service
	auth        *Authenticator
	storage     *storageapp.Service
}

func NewSubmissionsService(submissions *submissions.Service, sess *sessionsapp.Service, us *userapp.Service, storage *storageapp.Service) *SubmissionsService {
	return &SubmissionsService{
		submissions: submissions,
		auth:        NewAuthenticator(sess, us),
		storage:     storage,
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
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsAccept); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	if err := s.submissions.Approve(ctx, req.Id); err != nil {
		if strings.ToLower(err.Error()) == "idea already moderated" {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
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
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsDecline); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	if err := s.submissions.Decline(ctx, req.Id, req.Reason); err != nil {
		if strings.ToLower(err.Error()) == "idea already moderated" {
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		}
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
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsView); err != nil {
		return nil, status.Error(codes.PermissionDenied, "permission denied")
	}
	list, err := s.submissions.GetList(ctx)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	for _, item := range list {
		if item == nil || item.Info == nil {
			continue
		}
		applyPresignedProjectURLs(ctx, s.storage, item.Info)
	}
	return &submpb.ListResponse{Data: list, Tracing: TraceIDOrNew(ctx)}, nil
}
