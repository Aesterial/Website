package grpcserver

import (
	"Aesterial/backend/internal/app/info/sessions"
	"Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/app/notifications"
	"Aesterial/backend/internal/app/verification"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	"Aesterial/backend/internal/gen/types/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"fmt"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
)

type NotificationService struct {
	notifypb.UnimplementedNotificationServiceServer
	auth         *Authenticator
	user         *user.Service
	verification *verification.Service
	serv         *notifications.Service
}

func NewNotificationService(u *user.Service, sess *sessions.Service, verify *verification.Service, s *notifications.Service) *NotificationService {
	return &NotificationService{auth: NewAuthenticator(sess, u), verification: verify, serv: s, user: u}
}

func (s *NotificationService) All(ctx context.Context, _ *emptypb.Empty) (*notifypb.AllResponse, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.NotificationsViewAll); err != nil {
		return nil, err
	}
	list, err := s.serv.GetAll(ctx)
	if err != nil {
		logger.Debug("failed to receive list of notifications: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &notifypb.AllResponse{Data: list.Proto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *NotificationService) ForUser(ctx context.Context, req *notifypb.ForUserRequest) (*notifypb.ForUserResponse, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	user, err := s.user.GetUserByUID(ctx, requestor.UID)
	if err != nil {
		return nil, err
	}
	list, err := s.serv.ForUser(ctx, requestor.UID, user.Rank.Name, req.GetShown())
	if err != nil {
		logger.Debug("failed to get list of notifications for user: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &notifypb.ForUserResponse{Data: list.Proto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *NotificationService) Create(ctx context.Context, req *notifypb.CreateRequest) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		logger.Debug("error on getting user: " + err.Error(), "")
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, func() permsdomain.Permission {
		logger.Debug("checking permissions", "")
		switch req.GetScope() {
		case notifypb.Scope_SCOPE_USER:
			return permsdomain.NotificationsCreateUser
		case notifypb.Scope_SCOPE_BROADCAST:
			return permsdomain.NotificationsCreateBroadcast
		case notifypb.Scope_SCOPE_SEGMENT:
			return permsdomain.NotificationsCreateSegment
		default:
			return permsdomain.NotificationsCreateAll
		}
	}()); err != nil {
		return nil, err
	}
	expires := req.Expires.AsTime()
	logger.Debug(fmt.Sprintf("scope: %s, body: %s", req.GetScope().String(), req.GetBody()), "")
	err = s.serv.Create(ctx, req.GetScope(), req.GetBody(), req.Receiver, &expires)
	if err != nil {
		logger.Debug("failed to create notification: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &types.WithTracing{Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *NotificationService) Mark(ctx context.Context, req *notifypb.WithIDRequest) (*types.WithTracing, error) {
	if s == nil || s.serv == nil {
		return nil, apperrors.NotConfigured
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	id, err := uuid.Parse(req.GetId())
	if err != nil {
		return nil, apperrors.InvalidArguments
	}
	if err := s.serv.Mark(ctx, id, requestor.UID); err != nil {
		logger.Debug("failed to mark notification: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}
	return &types.WithTracing{Tracing: TraceIDOrNew(ctx)}, nil
}
