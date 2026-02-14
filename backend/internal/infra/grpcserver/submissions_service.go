package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/submissions"
	"Aesterial/backend/internal/domain/permissions"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	"Aesterial/backend/internal/gen/types/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"

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

func (s *SubmissionsService) Approve(ctx context.Context, req *submpb.ApproveRequest) (*types.WithTracing, error) {
	if s == nil || s.submissions == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("permission denied")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsAccept); err != nil {
		return nil, apperrors.AccessDenied.AddErrDetails("permission denied")
	}
	if err := s.submissions.Approve(ctx, req.Id); err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Approved submission", "submissions.approve.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *SubmissionsService) Decline(ctx context.Context, req *submpb.DeclineRequest) (*types.WithTracing, error) {
	if s == nil || s.submissions == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("permission denied")
	}
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsDecline); err != nil {
		return nil, apperrors.AccessDenied.AddErrDetails("permission denied")
	}
	if err := s.submissions.Decline(ctx, req.Id, req.Reason); err != nil {
		return nil, apperrors.Wrap(err)
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Declined submission", "submissions.decline.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &types.WithTracing{Tracing: traceID}, nil
}

func (s *SubmissionsService) List(ctx context.Context, _ *emptypb.Empty) (*submpb.ListResponse, error) {
	if s == nil || s.submissions == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("permission denied")
	}
	if err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsView); err != nil {
		return nil, apperrors.AccessDenied.AddErrDetails("permission denied")
	}
	list, err := s.submissions.GetList(ctx)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	projects := make([]*projpb.Project, 0, len(list))
	for _, item := range list {
		if item == nil || item.Info == nil {
			continue
		}
		projects = append(projects, item.Info)
	}
	applyPresignedProjectsURLs(ctx, s.storage, projects)
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got submissions list", "submissions.list.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &submpb.ListResponse{Data: list, Tracing: traceID}, nil
}

func (s *SubmissionsService) Get(ctx context.Context, req *submpb.GetRequest) (*submpb.GetResponse, error) {
	if s == nil || s.submissions == nil {
		return nil, apperrors.NotConfigured
	}
	if req.GetId() == 0 {
		return nil, apperrors.InvalidArguments
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("permission denied")
	}
	data, err := s.submissions.GetByID(ctx, req.GetId())
	if err != nil {
		logger.Debug("error on getting submissions info: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	err = s.auth.RequirePermissions(ctx, requestor.UID, permissions.SubmissionsView)
	if err != nil {
		if data.Info.Author.UserID != uint32(requestor.UID) {
			return nil, apperrors.AccessDenied.AddErrDetails("permission denied")
		}
	}
	applyPresignedProjectURLs(ctx, s.storage, data.Info)
	return &submpb.GetResponse{Data: data, Tracing: TraceIDOrNew(ctx)}, nil
}
