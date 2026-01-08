package projects

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	GetProject(ctx context.Context, id uuid.UUID) (*Project, error)
	GetProjectsByUID(ctx context.Context, uid int) ([]*Project, error)
	GetProjects(ctx context.Context, offset int, limit int) (Projects, error)
	GetCategories(ctx context.Context) ([]string, error)
	CreateProject(ctx context.Context, project Project) error
}
