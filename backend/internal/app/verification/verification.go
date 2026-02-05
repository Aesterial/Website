package verification

import (
	"Aesterial/backend/internal/app/mailer"
	"Aesterial/backend/internal/domain/verification"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"
)

type Service struct {
	repo   verification.Repository
	Mailer *mailer.Service
}

func New(repo verification.Repository, m *mailer.Service) *Service {
	return &Service{repo: repo, Mailer: m}
}

func (s *Service) Create(ctx context.Context, email string, purpose verification.Purpose, ip string, userAgent string, ttl time.Duration) (token string, err error) {
	if email == "" || ip == "" || userAgent == "" {
		return "", apperrors.RequiredDataMissing
	}
	token, err = s.repo.Create(ctx, email, purpose, ip, userAgent, ttl)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification.create")
		return "", apperrors.Wrap(err)
	}
	return token, nil
}

func (s *Service) Consume(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if token == "" || !purpose.IsValid() {
		return nil, apperrors.InvalidArguments
	}
	record, err := s.repo.Consume(ctx, purpose, token)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification.consume")
		return nil, apperrors.Wrap(err)
	}
	return record, nil
}

func (s *Service) BanEmail(ctx context.Context, email string, reason string) error {
	if email == "" || reason == "" {
		return apperrors.RequiredDataMissing
	}
	if err := s.repo.BanEmail(ctx, email, reason); err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification.ban_email")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) IsBanned(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperrors.RequiredDataMissing
	}
	banned, err := s.repo.IsBanned(ctx, email)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification.is_banned")
		return false, apperrors.Wrap(err)
	}
	return banned, nil
}

func (s *Service) GetRecord(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if !purpose.IsValid() || token == "" {
		return nil, apperrors.RequiredDataMissing
	}
	record, err := s.repo.GetRecord(ctx, purpose, token)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification.get_record")
		return nil, apperrors.Wrap(err)
	}
	return record, nil
}

func (s *Service) EmailExists(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, apperrors.RequiredDataMissing
	}
	found, err := s.repo.EmailExists(ctx, email)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "verification_email_exists")
		return false, apperrors.Wrap(err)
	}
	return found, nil
}
