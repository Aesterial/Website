package appstatistics

import (
	statscheduler "Aesterial/backend/internal/app/statistics/scheduler"
	"Aesterial/backend/internal/domain/statistics"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	"context"
	"errors"
	"time"
)

type StatService struct {
	repo statistics.Repository
}

func New(repo statistics.Repository) *StatService {
	statscheduler.Run(repo, time.Local)
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

func (s *StatService) UsersActivity(ctx context.Context, since time.Time) (map[time.Time]*statpb.UsersActivity, error) {
	if since.IsZero() {
		return nil, errors.New("since is null")
	}
	return s.repo.UsersActivity(ctx, since)
}

func (s *StatService) GetActiveUsers(ctx context.Context, since time.Time) (uint32, error) {
	return s.repo.GetOnlineUsers(ctx, since)
}

func (s *StatService) GetOfflineUsers(ctx context.Context, since time.Time) (uint32, error) {
	return s.repo.GetOfflineUsers(ctx, since)
}

func (s *StatService) NewIdeasCount(ctx context.Context, since time.Time) (uint32, error) {
	return s.repo.NewIdeasCount(ctx, since)
}

func (s *StatService) IdeasRecap(ctx context.Context) (*statpb.IdeasApprovalResponse, error) {
	return s.repo.IdeasRecap(ctx)
}

func (s *StatService) QualityRecap(ctx context.Context) (*statpb.EditorsGradeResponse, error) {
	return s.repo.QualityRecap(ctx)
}

func (s *StatService) MediaCoverage(ctx context.Context, limit int) ([]*statpb.MediaCoverageResponseMedia, error) {
	return s.repo.MediaCoverage(ctx, limit)
}