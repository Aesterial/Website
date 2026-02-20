package notifications

import (
	"Aesterial/backend/internal/domain/notifications"
	"Aesterial/backend/internal/infra/logger"
	"context"
	"time"

	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	apperrors "Aesterial/backend/internal/shared/errors"

	"github.com/google/uuid"
)

type Service struct {
	repo notifications.Repository
}

func New(r notifications.Repository) *Service {
	return &Service{repo: r}
}

func (s *Service) GetAll(ctx context.Context) (notifications.Notifications, error) {
	return s.repo.GetAll(ctx)
}

func (s *Service) ForUser(ctx context.Context, id uint, rank string, shown bool) (notifications.Notifications, error) {
	if id == 0 {
		return nil, apperrors.InvalidArguments
	}
	return s.repo.ForUser(ctx, id, rank, shown)
}

func (s *Service) Create(ctx context.Context, scope notifypb.Scope, body string, receiver *string, expires *time.Time) error {
	if scope == notifypb.Scope_SCOPE_UNSPECIFIED || body == "" {
		logger.Debug("on service", "")
		return apperrors.InvalidArguments
	}
	return s.repo.Create(ctx, scope, body, receiver, expires)
}

func (s *Service) Mark(ctx context.Context, id uuid.UUID, uid uint) error {
	if uid == 0 {
		return apperrors.InvalidArguments
	}
	return s.repo.Mark(ctx, id, uid)
}
