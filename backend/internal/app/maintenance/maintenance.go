package maintenance

import (
	scheduler "Aesterial/backend/internal/app/maintenance/scheduler"
	"Aesterial/backend/internal/domain/maintenance"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"
)

type Service struct {
	repo maintenance.Repository
}

func New(r maintenance.Repository) *Service {
	scheduler.Start(r, time.Second * 10)
	return &Service{repo: r}
}

func (s *Service) CheckIsActive(ctx context.Context) (bool, error) {
	active, err := s.repo.CheckIsActive(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.check_is_active")
		return false, apperrors.Wrap(err)
	}
	return active, nil
}

func (s *Service) IsPlanned(ctx context.Context) (bool, error) {
	planned, err := s.repo.IsPlanned(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.is_planned")
		return false, apperrors.Wrap(err)
	}
	return planned, nil
}

func (s *Service) GetData(ctx context.Context) (*maintenance.Information, error) {
	data, err := s.repo.GetData(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.get_data")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *Service) Start(ctx context.Context, req maintenance.CreateST, by uint) error {
	if by == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("requestor is not provided")
	}
	if err := s.repo.Start(ctx, req, by); err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.start")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Edit(ctx context.Context, req maintenance.EditST) error {
	if err := s.repo.Edit(ctx, req); err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.edit")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Complete(ctx context.Context) error {
	if err := s.repo.Complete(ctx); err != nil {
		logger.Debug("error appeared: "+err.Error(), "maintenance.complete")
		return apperrors.Wrap(err)
	}
	return nil
}
