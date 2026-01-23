package login

import (
	domain "Aesterial/backend/internal/domain/login"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"
)

func (s *Service) GetUIDByEmail(ctx context.Context, email string) (*uint, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("login repo not configured")
	}
	email = strings.TrimSpace(email)
	if email == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	uid, err := s.repo.GetUIDByEmail(ctx, email)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.get_uid_by_email")
		return nil, apperrors.Wrap(err)
	}
	return uid, nil
}

func (s *Service) GetOAuthUID(ctx context.Context, service domain.OAuthService, linkedID string) (*uint, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("login repo not configured")
	}
	if !service.IsValid() || strings.TrimSpace(linkedID) == "" {
		return nil, apperrors.InvalidArguments.AddErrDetails("oauth params are invalid")
	}
	uid, err := s.repo.GetOAuthUID(ctx, service, linkedID)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.get_oauth_uid")
		return nil, apperrors.Wrap(err)
	}
	return uid, nil
}

func (s *Service) LinkOAuth(ctx context.Context, service domain.OAuthService, linkedID string, uid uint) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured.AddErrDetails("login repo not configured")
	}
	if !service.IsValid() || strings.TrimSpace(linkedID) == "" || uid == 0 {
		return apperrors.InvalidArguments.AddErrDetails("oauth params are invalid")
	}
	if err := s.repo.LinkOAuth(ctx, service, linkedID, uid); err != nil {
		logger.Debug("error appeared: "+err.Error(), "auth.link_oauth")
		return apperrors.Wrap(err)
	}
	return nil
}
