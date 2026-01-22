package user

import (
	"Aesterial/backend/internal/domain/user"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"strings"
)

type Service struct {
	repo user.Repository
}

func New(repo user.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) UpdateName(ctx context.Context, id uint, name string) (*user.User, error) {
	if id == 0 {
		return nil, apperrors.InvalidArguments
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, apperrors.InvalidArguments
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.RecordNotFound
		}
		logger.Debug("error appeared: "+err.Error(), "user_modifier.update_name")
		return nil, apperrors.Wrap(err)
	}

	if err = s.repo.UpdateDisplayName(ctx, id, trimmed); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user_modifier.update_name.save")
		return nil, apperrors.Wrap(err)
	}

	if u.Settings == nil {
		u.Settings = &user.Settings{}
	}
	u.Settings.DisplayName = &trimmed

	return u, nil
}

func (s *Service) UpdateAvatar(ctx context.Context, id uint, avatar user.Avatar) (*user.User, error) {
	if id == 0 {
		return nil, apperrors.InvalidArguments
	}
	if strings.TrimSpace(avatar.Key) == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("avatar key is empty")
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.RecordNotFound
		}
		logger.Debug("error appeared: "+err.Error(), "user_modifier.update_avatar")
		return nil, apperrors.Wrap(err)
	}

	if err := s.repo.AddAvatar(ctx, id, avatar); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user_modifier.update_avatar.save")
		return nil, apperrors.Wrap(err)
	}

	if u.Settings == nil {
		u.Settings = &user.Settings{}
	}
	u.Settings.Avatar = &avatar
	return u, nil
}

func (s *Service) DeleteAvatar(ctx context.Context, id uint) (*user.Avatar, error) {
	if id == 0 {
		return nil, apperrors.InvalidArguments
	}
	avatar, err := s.repo.GetAvatar(ctx, id)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "user_modifier.delete_avatar.get")
		return nil, apperrors.Wrap(err)
	}
	if avatar == nil || strings.TrimSpace(avatar.Key) == "" {
		return nil, apperrors.RecordNotFound.AddErrDetails("avatar not found")
	}
	if err := s.repo.DeleteAvatar(ctx, id); err != nil {
		logger.Debug("error appeared: "+err.Error(), "user_modifier.delete_avatar.save")
		return nil, apperrors.Wrap(err)
	}
	return avatar, nil
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	var appErr apperrors.ErrorST
	if errors.As(err, &appErr) {
		return appErr.Is(apperrors.RecordNotFound)
	}
	return strings.EqualFold(err.Error(), "user not found")
}
