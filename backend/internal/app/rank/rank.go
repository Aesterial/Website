package rank

import (
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	"context"
	"errors"
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
		return errors.New("ranks service not configured")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("rank name is empty")
	}
	description = strings.TrimSpace(description)
	if description == "" {
		return errors.New("rank description is empty")
	}
	if color == 0 {
		return errors.New("rank color is empty")
	}
	if perms != nil {
		return s.repo.Create(ctx, name, color, description, *perms)
	}
	return s.repo.Create(ctx, name, color, description)
}

func (s *Service) Edit(ctx context.Context, name string, target string, data any) error {
	if s == nil || s.repo == nil {
		return errors.New("ranks service not configured")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("rank name is empty")
	}
	target = strings.TrimSpace(target)
	if target == "" {
		return errors.New("rank target is empty")
	}
	if data == nil {
		return errors.New("rank data is empty")
	}
	return s.repo.Edit(ctx, name, target, data)
}

func (s *Service) Get(ctx context.Context, name string) (*rank.Rank, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("ranks service not configured")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("rank name is empty")
	}
	return s.repo.Get(ctx, name)
}

func (s *Service) Delete(ctx context.Context, name string) error {
	if s == nil || s.repo == nil {
		return errors.New("ranks service not configured")
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return errors.New("rank name is empty")
	}
	return s.repo.Delete(ctx, name)
}

func (s *Service) List(ctx context.Context) ([]*rank.Rank, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("ranks service not configured")
	}
	return s.repo.List(ctx)
}

func (s *Service) UsersWithRank(ctx context.Context, name string) ([]*uint, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("ranks service not configured")
	}
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("rank name is empty")
	}
	return s.repo.UsersWithRank(ctx, name)
}

func (s *Service) Perms(ctx context.Context, name string) (*permissions.Permissions, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("ranks service not configured")
	}
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("rank name is empty")
	}
	return s.repo.Perms(ctx, name)
}

func (s *Service) ChangePerms(ctx context.Context, name string, perm permissions.Permission, state bool) error {
	if s == nil || s.repo == nil {
		return errors.New("ranks service not configured")
	}
	if strings.TrimSpace(name) == "" {
		return errors.New("rank name is empty")
	}
	if strings.TrimSpace(perm.String()) == "" {
		return errors.New("permission is empty")
	}
	return s.repo.ChangePerms(ctx, name, perm, state)
}
