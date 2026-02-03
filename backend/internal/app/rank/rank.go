package rank

import (
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"
)

type Service struct {
	repo rank.Repository
}

func New(repo rank.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, name string, color int, description string, perms *permissions.Permissions) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	description = strings.TrimSpace(description)
	if description == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank description is empty")
	}
	if color == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("rank color is empty")
	}
	if perms != nil {
		if err := s.repo.Create(ctx, name, color, description, *perms); err != nil {
			logger.Debug("error appeared: "+err.Error(), "rank.create")
			return apperrors.Wrap(err)
		}
		return nil
	}
	if err := s.repo.Create(ctx, name, color, description); err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.create")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Edit(ctx context.Context, name string, target string, data any) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	target = strings.TrimSpace(target)
	if target == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank target is empty")
	}
	if data == nil {
		return apperrors.RequiredDataMissing.AddErrDetails("rank data is empty")
	}
	if err := s.repo.Edit(ctx, name, target, data); err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.edit")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) Get(ctx context.Context, name string) (*rank.Rank, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	data, err := s.repo.Get(ctx, name)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.get")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *Service) Delete(ctx context.Context, name string) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	if err := s.repo.Delete(ctx, name); err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.delete")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) List(ctx context.Context) ([]*rank.Rank, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.List(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.list")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) UsersWithRank(ctx context.Context, name string) ([]*uint, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	if strings.TrimSpace(name) == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	list, err := s.repo.UsersWithRank(ctx, name)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.users_with_rank")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) Perms(ctx context.Context, name string) (*permissions.Permissions, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	if strings.TrimSpace(name) == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	perms, err := s.repo.Perms(ctx, name)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.perms")
		return nil, apperrors.Wrap(err)
	}
	return perms, nil
}

func (s *Service) ChangePerms(ctx context.Context, name string, perm permissions.Permission, state bool) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if strings.TrimSpace(name) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("rank name is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("permission is empty")
	}
	if err := s.repo.ChangePerms(ctx, name, perm, state); err != nil {
		logger.Debug("error appeared: "+err.Error(), "rank.change_perms")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) CanEdit(ctx context.Context, current string, target string) (bool, error) {
	if s == nil || s.repo == nil {
		return false, apperrors.NotConfigured
	}
	return s.repo.CanEdit(ctx, current, target)
}