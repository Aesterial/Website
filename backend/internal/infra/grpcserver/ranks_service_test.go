package grpcserver_test

import (
	"context"
	"testing"

	rankapp "Aesterial/backend/internal/app/rank"
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	rankpb "Aesterial/backend/internal/gen/ranks/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
	"google.golang.org/protobuf/types/known/emptypb"
)

type rankRepoStub struct {
	createErr error
	list      []*rank.Rank
}

func (r *rankRepoStub) Create(ctx context.Context, name string, color int, description string, perms ...permissions.Permissions) error {
	return r.createErr
}

func (r *rankRepoStub) Edit(context.Context, string, string, any) error {
	return nil
}

func (r *rankRepoStub) Delete(context.Context, string) error {
	return nil
}

func (r *rankRepoStub) Get(context.Context, string) (*rank.Rank, error) {
	return nil, nil
}

func (r *rankRepoStub) List(context.Context) ([]*rank.Rank, error) {
	return r.list, nil
}

func (r *rankRepoStub) UsersWithRank(context.Context, string) ([]*uint, error) {
	return nil, nil
}

func (r *rankRepoStub) Perms(context.Context, string) (*permissions.Permissions, error) {
	return nil, nil
}

func (r *rankRepoStub) ChangePerms(context.Context, string, permissions.Permission, bool) error {
	return nil
}

func TestRanksServiceCreateMissingName(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &rankRepoStub{}
	ranksSvc := rankapp.New(repo)
	svc := grpcserver.NewRanksService(ranksSvc, sessionsSvc, userSvc, nil)

	_, err := svc.Create(ctx, &rankpb.CreateRequest{Name: ""})
	assertAppError(t, err, apperrors.RequiredDataMissing)
}

func TestRanksServiceListSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &rankRepoStub{list: []*rank.Rank{{Name: "member", Color: 1, Description: "desc"}}}
	ranksSvc := rankapp.New(repo)
	svc := grpcserver.NewRanksService(ranksSvc, sessionsSvc, userSvc, nil)

	resp, err := svc.List(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if resp == nil || len(resp.Ranks) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}
