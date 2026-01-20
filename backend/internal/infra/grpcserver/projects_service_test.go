package grpcserver_test

import (
	"context"
	"testing"

	projectsapp "Aesterial/backend/internal/app/projects"
	"Aesterial/backend/internal/domain/projects"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
)

type projectsRepoStub struct {
	categories []string
}

func (p *projectsRepoStub) GetProject(context.Context, uuid.UUID) (*projects.Project, error) {
	return nil, nil
}

func (p *projectsRepoStub) GetProjectsByUID(context.Context, int) (projects.Projects, error) {
	return nil, nil
}

func (p *projectsRepoStub) GetTopProjects(context.Context, int, string) (projects.Projects, error) {
	return nil, nil
}

func (p *projectsRepoStub) GetProjects(context.Context, int, int, ...projects.ProjectOption) (projects.Projects, error) {
	return nil, nil
}

func (p *projectsRepoStub) GetCategories(context.Context) ([]string, error) {
	return p.categories, nil
}

func (p *projectsRepoStub) CreateProject(context.Context, projects.Project) error {
	return nil
}

func (p *projectsRepoStub) ToggleLike(context.Context, uuid.UUID, uint) error {
	return nil
}

func TestProjectServiceCreateMissingTitle(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{}
	projectsSvc := projectsapp.New(repo)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	_, err := svc.Create(ctx, &projpb.CreateRequest{Title: ""})
	assertAppError(t, err, apperrors.RequiredDataMissing)
}

func TestProjectServiceCategoriesSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{categories: []string{"roads"}}
	projectsSvc := projectsapp.New(repo)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	resp, err := svc.Categories(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("Categories() error: %v", err)
	}
	if resp == nil || len(resp.Categories) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}
