package appstatistics

import (
	"ascendant/backend/internal/domain/statistics"
	statpb "ascendant/backend/internal/gen/statistics/v1"
	"context"
	"errors"
	"time"
)

type StatService struct {
	repo statistics.Repository
}

func New(repo statistics.Repository) *StatService {
	return &StatService{repo}
}

func (s *StatService) VoteCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, errors.New("since is null")
	}
	return s.repo.VoteCount(ctx, since)
}

func (s *StatService) VoteCategories(ctx context.Context, since time.Time, limit int) ([]*statpb.CategoryRecord, error) {
	if since.IsZero() {
		return nil, errors.New("since is null")
	}
	if limit <= 0 {
		return nil, errors.New("limit is null")
	}
	return s.repo.VoteCategories(ctx, since, limit)
}
