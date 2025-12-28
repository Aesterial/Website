package permissions

import (
	"ascendant/backend/internal/domain/permissions"
	"context"
	"errors"
)

type Service struct {
	repo permissions.Repository
}

func New(repo permissions.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetForRank(ctx context.Context, rank string) (*permissions.Permissions, error) {
	if rank == "" {
		return nil, errors.New("rank is empty")
	}
	return s.repo.GetForRank(ctx, rank)
}

func (s *Service) GetForUser(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	if uid == 0 {
		return nil, errors.New("uid is empty")
	}
	return s.repo.GetForUser(ctx, uid)
}

func (s *Service) Has(ctx context.Context, uid uint, need permissions.Permission) (bool, error) {
	if uid == 0 {
		return false, errors.New("arguments empty")
	}
	return s.repo.Has(ctx, uid, need)
}

func (s *Service) HasAll(ctx context.Context, uid uint, need ...permissions.Permission) (bool, error) {
	if len(need) == 0 || uid == 0 {
		return false, errors.New("uid or needed permissions empty")
	}
	return s.repo.HasAll(ctx, uid, need...)
}

func (s *Service) ChangeForUser(ctx context.Context, uid uint, need permissions.Permission, state bool) error {
	if uid == 0 {
		return errors.New("arguments empty")
	}
	return s.repo.ChangeForUser(ctx, uid, need, state)
}

func (s *Service) ChangeForRank(ctx context.Context, rank string, need permissions.Permission, state bool) error {
	if rank == "" {
		return errors.New("arguments empty")
	}
	return s.repo.ChangeForRank(ctx, rank, need, state)
}
