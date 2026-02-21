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
	authorUID  uint
	edited     bool
	deleted    bool
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

func (p *projectsRepoStub) Messages(context.Context, uuid.UUID) (projects.ProjectMessages, error) {
	return nil, nil
}

func (p *projectsRepoStub) CreateMessage(context.Context, uuid.UUID, uint, string, *int64) error {
	return nil
}

func (p *projectsRepoStub) EditMessage(context.Context, uuid.UUID, int64, string) error {
	p.edited = true
	return nil
}

func (p *projectsRepoStub) DeleteMessage(context.Context, uuid.UUID, int64) error {
	p.deleted = true
	return nil
}

func (p *projectsRepoStub) GetMessageAuthorUID(context.Context, int64) (uint, error) {
	if p.authorUID != 0 {
		return p.authorUID, nil
	}
	return 10, nil
}

func (p *projectsRepoStub) GetCategories(context.Context) ([]string, error) {
	return p.categories, nil
}

func (p *projectsRepoStub) CreateProject(context.Context, projects.Project) (*uuid.UUID, error) {
	return nil, nil
}

func (p *projectsRepoStub) AddProjectPhoto(context.Context, uuid.UUID, string, string, int) error {
	return nil
}

func (p *projectsRepoStub) ToggleLike(context.Context, uuid.UUID, uint) error {
	return nil
}

func TestProjectServiceCreateMissingTitle(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{}
	projectsSvc := projectsapp.New(repo, nil)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	_, err := svc.Create(ctx, &projpb.CreateRequest{Title: ""})
	assertAppError(t, err, apperrors.RequiredDataMissing)
}

func TestProjectServiceCategoriesSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{categories: []string{"roads"}}
	projectsSvc := projectsapp.New(repo, nil)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	resp, err := svc.Categories(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("Categories() error: %v", err)
	}
	if resp == nil || len(resp.Categories) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestProjectServiceUpdateMessageSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{authorUID: 10}
	projectsSvc := projectsapp.New(repo, nil)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	_, err := svc.UpdateMessage(ctx, &projpb.UpdateMessageRequest{
		Id:      uuid.NewString(),
		MId:     1,
		Content: "updated",
	})
	if err != nil {
		t.Fatalf("UpdateMessage() error: %v", err)
	}
	if !repo.edited {
		t.Fatal("expected EditMessage to be called")
	}
}

func TestProjectServiceDeleteMessageSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	repo := &projectsRepoStub{authorUID: 10}
	projectsSvc := projectsapp.New(repo, nil)
	svc := grpcserver.NewProjectService(projectsSvc, sessionsSvc, userSvc, nil)

	_, err := svc.DeleteMessage(ctx, &projpb.DeleteMessageRequest{
		Id:  uuid.NewString(),
		MId: 1,
	})
	if err != nil {
		t.Fatalf("DeleteMessage() error: %v", err)
	}
	if !repo.deleted {
		t.Fatal("expected DeleteMessage to be called")
	}
}
