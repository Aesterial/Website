package projects

import (
	"Aesterial/backend/internal/domain/projects"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo projects.Repository
}

func New(repo projects.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateProject(ctx context.Context, project projects.Project) (*uuid.UUID, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	if project.Author == nil || project.Author.UID == 0 {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("author is empty")
	}

	title := strings.TrimSpace(project.Info.Title)
	if title == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("title is empty")
	}
	project.Info.Title = title

	project.Info.Description = strings.TrimSpace(project.Info.Description)
	project.Info.Category = projects.ProjectCategory(strings.TrimSpace(project.Info.Category.String()))
	if project.Info.Category == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("category is empty")
	}

	project.Info.Location.City = strings.TrimSpace(project.Info.Location.City)

	id, err := s.repo.CreateProject(ctx, project)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.create_project")
		return nil, apperrors.Wrap(err)
	}
	return id, nil
}

func (s *Service) AddProjectPhoto(ctx context.Context, projectID uuid.UUID, key string, contentType string, sizeBytes int) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if projectID == uuid.Nil {
		return apperrors.RequiredDataMissing.AddErrDetails("project id is empty")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("photo key is empty")
	}
	contentType = strings.TrimSpace(contentType)
	if err := s.repo.AddProjectPhoto(ctx, projectID, key, contentType, sizeBytes); err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.add_project_photo")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) GetCategories(ctx context.Context) ([]string, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.GetCategories(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_categories")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetProjects(ctx context.Context, offset int, limit int, opts ...projects.ProjectOption) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.GetProjects(ctx, offset, limit, opts...)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_projects")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetArchivedProjects(ctx context.Context, offset int, limit int) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.GetProjects(ctx, offset, limit, projects.WithStatus("archived"))
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_archived_projects")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetProjectsByUID(ctx context.Context, uid int) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.GetProjectsByUID(ctx, uid)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_projects_by_uid")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetTopProjects(ctx context.Context, limit int, city string) (projects.Projects, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	list, err := s.repo.GetTopProjects(ctx, limit, city)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_top_projects")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *Service) GetProject(ctx context.Context, id uuid.UUID) (*projects.Project, error) {
	if s == nil || s.repo == nil {
		return nil, apperrors.NotConfigured
	}
	project, err := s.repo.GetProject(ctx, id)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.get_project")
		return nil, apperrors.Wrap(err)
	}
	return project, nil
}

func (s *Service) ToggleLike(ctx context.Context, id uuid.UUID, userID uint) error {
	if s == nil || s.repo == nil {
		return apperrors.NotConfigured
	}
	if userID == 0 {
		return apperrors.RequiredDataMissing.AddErrDetails("user is empty")
	}
	if err := s.repo.ToggleLike(ctx, id, userID); err != nil {
		logger.Debug("error appeared: "+err.Error(), "projects.toggle_like")
		return apperrors.Wrap(err)
	}
	return nil
}
