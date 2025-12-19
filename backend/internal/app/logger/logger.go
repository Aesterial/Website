package logger

import (
	"ascendant/backend/internal/infra/logger"
	"context"
)

type Service struct {
	repo logger.Repository
}

func New(repo logger.Repository) *Service {
	return &Service{repo}
}

func (s *Service) Append(ctx context.Context, event logger.Event) error {
	return s.repo.Append(ctx, event)
}

func (s *Service) GetList(ctx context.Context, limit uint, offset uint) ([]*logger.Event, error) {
	return s.repo.GetList(ctx, limit, offset)
}
