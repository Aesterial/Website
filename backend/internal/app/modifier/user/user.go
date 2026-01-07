package user

import (
	"ascendant/backend/internal/domain/user"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"errors"
	"strconv"
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
		return nil, apperrors.BuildError(
			"InvalidUserID",
			"user id must be greater than zero",
			map[string]string{"userID": "must be greater than zero"},
			"",
		)
	}

	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, apperrors.BuildError(
			"InvalidName",
			"name must not be empty",
			map[string]string{"name": "must not be empty"},
			"",
		)
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.UserNotFound(strconv.FormatUint(uint64(id), 10), "")
		}
		return nil, err
	}

	if err = s.repo.UpdateDisplayName(ctx, id, trimmed); err != nil {
		return nil, err
	}

	if u.Settings == nil {
		u.Settings = &user.Settings{}
	}
	u.Settings.DisplayName = &trimmed

	return u, nil
}

func (s *Service) UpdateAvatar(ctx context.Context, id uint, avatar user.Avatar) (*user.User, error) {
	if id == 0 {
		return nil, apperrors.BuildError(
			"InvalidUserID",
			"user id must be greater than zero",
			map[string]string{"userID": "must be greater than zero"},
			"",
		)
	}
	if strings.TrimSpace(avatar.Key) == "" {
		return nil, errors.New("avatar key is empty")
	}

	u, err := s.repo.GetUserByUID(ctx, id)
	if err != nil {
		if isNotFound(err) {
			return nil, apperrors.UserNotFound(strconv.FormatUint(uint64(id), 10), "")
		}
		return nil, err
	}

	if err := s.repo.AddAvatar(ctx, id, avatar); err != nil {
		return nil, err
	}

	if u.Settings == nil {
		u.Settings = &user.Settings{}
	}
	u.Settings.Avatar = &avatar
	return u, nil
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.EqualFold(err.Error(), "user not found")
}
