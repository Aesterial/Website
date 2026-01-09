package projects

import (
	"ascendant/backend/internal/domain/projects"
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo projects.Repository
}

func New(repo projects.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateProject(ctx context.Context, project projects.Project) error {
	if s == nil || s.repo == nil {
		return errors.New("projects service not configured")
	}
	if project.Author == nil || project.Author.UID == 0 {
		return errors.New("author is empty")
	}

	title := strings.TrimSpace(project.Info.Title)
	if title == "" {
		return errors.New("title is empty")
	}
	project.Info.Title = title

	project.Info.Description = strings.TrimSpace(project.Info.Description)
	project.Info.Category = projects.ProjectCategory(strings.TrimSpace(project.Info.Category.String()))
	if project.Info.Category == "" {
		return errors.New("category is empty")
	}

	project.Info.Location.City = strings.TrimSpace(project.Info.Location.City)
	project.Info.Location.Street = strings.TrimSpace(project.Info.Location.Street)
	project.Info.Location.House = strings.TrimSpace(project.Info.Location.House)

	return s.repo.CreateProject(ctx, project)
}

func (s *Service) GetCategories(ctx context.Context) ([]string, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projects service not configured")
	}
	return s.repo.GetCategories(ctx)
}

func (s *Service) GetProjects(ctx context.Context, offset int, limit int, opts ...projects.ProjectOption) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projects service not configured")
	}
	return s.repo.GetProjects(ctx, offset, limit, opts...)
}

func (s *Service) GetArchivedProjects(ctx context.Context, offset int, limit int) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projects service not configured")
	}
	return s.repo.GetProjects(ctx, offset, limit, projects.WithStatus("archived"))
}

func (s *Service) GetProjectsByUID(ctx context.Context, uid int) ([]*projects.Project, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projects service not configured")
	}
	return s.repo.GetProjectsByUID(ctx, uid)
}

func (s *Service) GetProject(ctx context.Context, id uuid.UUID) (*projects.Project, error) {
	if s == nil || s.repo == nil {
		return nil, errors.New("projects service not configured")
	}
	return s.repo.GetProject(ctx, id)
}

func (s *Service) ToggleLike(ctx context.Context, id uuid.UUID, userID uint) error {
	if s == nil || s.repo == nil {
		return errors.New("projects service not configured")
	}
	if userID == 0 {
		return errors.New("user is empty")
	}
	return s.repo.ToggleLike(ctx, id, userID)
}
