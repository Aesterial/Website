package grpcserver_test

import (
	"context"
	"errors"
	"testing"
	"time"

	appstatistics "Aesterial/backend/internal/app/statistics"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
	"google.golang.org/protobuf/types/known/emptypb"
)

type statisticsRepoStub struct {
	voteCount uint32
	voteErr   error
}

func (s *statisticsRepoStub) GetOfflineUsers(context.Context, time.Time) (uint32, error) {
	return 0, nil
}

func (s *statisticsRepoStub) GetOnlineUsers(context.Context, time.Time) (uint32, error) {
	return 0, nil
}

func (s *statisticsRepoStub) NewIdeasCount(context.Context, time.Time) (uint32, error) {
	return 0, nil
}

func (s *statisticsRepoStub) SaveStatisticsRecap(context.Context) error {
	return nil
}

func (s *statisticsRepoStub) StatisticsRecap(context.Context, time.Time) (map[time.Time]*statpb.StatisticsRecap, error) {
	return nil, nil
}

func (s *statisticsRepoStub) UsersActivity(context.Context, time.Time) (map[time.Time]*statpb.UsersActivity, error) {
	return nil, s.voteErr
}

func (s *statisticsRepoStub) VoteCategories(context.Context, time.Time, int) ([]*statpb.CategoryRecord, error) {
	return nil, nil
}

func (s *statisticsRepoStub) VoteCount(context.Context, time.Time) (uint32, error) {
	if s.voteErr != nil {
		return 0, s.voteErr
	}
	return s.voteCount, nil
}

func (s *statisticsRepoStub) IdeasRecap(context.Context) (*statpb.IdeasApprovalResponse, error) {
	return &statpb.IdeasApprovalResponse{}, nil
}

func (s *statisticsRepoStub) QualityRecap(context.Context) (*statpb.EditorsGradeResponse, error) {
	return &statpb.EditorsGradeResponse{}, nil
}

func (s *statisticsRepoStub) MediaCoverage(context.Context, int) ([]*statpb.MediaCoverageResponseMedia, error) {
	return nil, nil
}

func TestStatServiceVotesDaySuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &statisticsRepoStub{voteCount: 7}
	statSvc := appstatistics.New(repo)
	svc := grpcserver.NewStatService(statSvc, sessionsSvc, userSvc)

	resp, err := svc.VotesDay(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("VotesDay() error: %v", err)
	}
	if resp == nil || resp.Count != 7 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestStatServiceUsersActivityError(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &statisticsRepoStub{voteErr: errors.New("boom")}
	statSvc := appstatistics.New(repo)
	svc := grpcserver.NewStatService(statSvc, sessionsSvc, userSvc)

	_, err := svc.UsersActivity(ctx, &statpb.UsersActivityRequest{Limit: 7})
	assertAppError(t, err, apperrors.ServerError)
}
