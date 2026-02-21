package grpcserver_test

import (
	"context"
	"errors"
	"testing"
	"time"

	submissionsapp "Aesterial/backend/internal/app/submissions"
	"Aesterial/backend/internal/domain/projects"
	subdomain "Aesterial/backend/internal/domain/submissions"
	"Aesterial/backend/internal/domain/user"
	submpb "Aesterial/backend/internal/gen/submissions/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
)

type submissionsRepoStub struct {
	list       []*subdomain.Submission
	approveErr error
}

func (s *submissionsRepoStub) GetList(context.Context) ([]*subdomain.Submission, error) {
	return s.list, nil
}

func (s *submissionsRepoStub) GetByID(ctx context.Context, id int32) (*subdomain.Submission, error) {
	return nil, nil
}

func (s *submissionsRepoStub) AlreadySetted(context.Context, int32) (bool, error) {
	return false, nil
}

func (s *submissionsRepoStub) Approve(context.Context, int32) error {
	return s.approveErr
}

func (s *submissionsRepoStub) Decline(context.Context, int32, string) error {
	return nil
}

type submissionsProjectsRepoStub struct {
	project  *projects.Project
	projects map[uuid.UUID]*projects.Project
	err      error
}

func (p *submissionsProjectsRepoStub) GetProject(ctx context.Context, id uuid.UUID) (*projects.Project, error) {
	if p.err != nil {
		return nil, p.err
	}
	if p.projects != nil {
		return p.projects[id], nil
	}
	return p.project, nil
}

func (p *submissionsProjectsRepoStub) GetProjectsByUID(context.Context, int) (projects.Projects, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) GetTopProjects(context.Context, int, string) (projects.Projects, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) GetProjects(context.Context, int, int, ...projects.ProjectOption) (projects.Projects, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) Messages(context.Context, uuid.UUID) (projects.ProjectMessages, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) CreateMessage(context.Context, uuid.UUID, uint, string, *int64) error {
	return nil
}

func (p *submissionsProjectsRepoStub) EditMessage(context.Context, uuid.UUID, int64, string) error {
	return nil
}

func (p *submissionsProjectsRepoStub) DeleteMessage(context.Context, uuid.UUID, int64) error {
	return nil
}

func (p *submissionsProjectsRepoStub) GetMessageAuthorUID(context.Context, int64) (uint, error) {
	return 0, nil
}

func (p *submissionsProjectsRepoStub) GetCategories(context.Context) ([]string, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) CreateProject(context.Context, projects.Project) (*uuid.UUID, error) {
	return nil, nil
}

func (p *submissionsProjectsRepoStub) AddProjectPhoto(context.Context, uuid.UUID, string, string, int) error {
	return nil
}

func (p *submissionsProjectsRepoStub) ToggleLike(context.Context, uuid.UUID, uint) error {
	return nil
}

func TestSubmissionsServiceListSuccess(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)

	project := &projects.Project{
		ID:     uuid.New(),
		Author: &user.User{UID: 10, Username: "tester", Rank: testUser(10).Rank, Joined: time.Now()},
		At:     time.Now(),
	}
	project.Author.Settings = &user.Settings{}

	subRepo := &submissionsRepoStub{list: []*subdomain.Submission{{ID: 1, ProjectID: project.ID, State: "active"}}}
	projRepo := &submissionsProjectsRepoStub{project: project}
	usrRepo := &authUserRepoStub{
		getUserByUIDFn: func(context.Context, uint) (*user.User, error) {
			return project.Author, nil
		},
	}

	svc := grpcserver.NewSubmissionsService(submissionsapp.New(subRepo, projRepo, usrRepo), sessionsSvc, userSvc, nil)
	resp, err := svc.List(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if resp == nil || len(resp.Data) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestSubmissionsServiceApproveError(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	subRepo := &submissionsRepoStub{approveErr: errors.New("boom")}
	svc := grpcserver.NewSubmissionsService(submissionsapp.New(subRepo, &submissionsProjectsRepoStub{}, &authUserRepoStub{}), sessionsSvc, userSvc, nil)

	_, err := svc.Approve(ctx, &submpb.ApproveRequest{Id: 1})
	assertAppError(t, err, apperrors.ServerError)
}

func TestSubmissionsServiceListSkipsBrokenEntries(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)

	validProject := &projects.Project{
		ID:     uuid.New(),
		Author: &user.User{UID: 10, Username: "tester", Rank: testUser(10).Rank, Joined: time.Now()},
		At:     time.Now(),
	}
	validProject.Author.Settings = &user.Settings{}

	missingProjectID := uuid.New()

	subRepo := &submissionsRepoStub{
		list: []*subdomain.Submission{
			{ID: 1, ProjectID: validProject.ID, State: "active"},
			{ID: 2, ProjectID: missingProjectID, State: "active"},
		},
	}
	projRepo := &submissionsProjectsRepoStub{
		projects: map[uuid.UUID]*projects.Project{
			validProject.ID: validProject,
		},
	}
	usrRepo := &authUserRepoStub{
		getUserByUIDFn: func(context.Context, uint) (*user.User, error) {
			return validProject.Author, nil
		},
	}

	svc := grpcserver.NewSubmissionsService(submissionsapp.New(subRepo, projRepo, usrRepo), sessionsSvc, userSvc, nil)
	resp, err := svc.List(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("List() error: %v", err)
	}
	if resp == nil || len(resp.Data) != 1 {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if resp.Data[0].Id != 1 {
		t.Fatalf("expected submission id 1, got %d", resp.Data[0].Id)
	}
}
