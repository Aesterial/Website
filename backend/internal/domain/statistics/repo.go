package statistics

import (
	"context"
	"time"
)

import statpb "ascendant/backend/internal/gen/statistics/v1"

type Repository interface {
	GetOfflineUsers(ctx context.Context, since time.Time) (uint32, error)
	GetOnlineUsers(ctx context.Context, since time.Time) (uint32, error)
	NewIdeasCount(ctx context.Context, since time.Time) (uint32, error)
	StatisticsRecap(ctx context.Context, since time.Time) (map[time.Time]*statpb.StatisticsRecap, error)
	UsersActivity(ctx context.Context, since time.Time) (map[time.Time]*statpb.UsersActivity, error)
	VoteCategories(ctx context.Context, since time.Time, limit int) ([]*statpb.CategoryRecord, error)
	VoteCount(ctx context.Context, since time.Time) (uint32, error)
	IdeasRecap(ctx context.Context) (*statpb.IdeasApprovalResponse, error)
	QualityRecap(ctx context.Context) ([]*statpb.EditorsGradeResponse, error)
	MediaCoverage(ctx context.Context) (map[int64]*statpb.MediaCoverageResponseMedia, error)
}
