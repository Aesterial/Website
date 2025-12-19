package user

import (
	"ascendant/backend/internal/domain/user"
	apperrors "ascendant/backend/internal/shared/errors"
	"context"
	"strconv"
	"strings"
)

type Service struct {
	repo user.Repository
}

func New(repo user.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByID(ctx context.Context, id uint) (*user.User, error) {
	if id == 0 {
		return nil, apperrors.BuildError(
			"InvalidUserID",
			"user id must be greater than zero",
			map[string]string{"userID": "must be greater than zero"},
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

	return u, nil
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	return strings.EqualFold(err.Error(), "user not found")
}
