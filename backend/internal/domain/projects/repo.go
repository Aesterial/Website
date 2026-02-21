package projects

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	GetProject(ctx context.Context, id uuid.UUID) (*Project, error)
	GetProjectsByUID(ctx context.Context, uid int) (Projects, error)
	GetTopProjects(ctx context.Context, limit int, city string) (Projects, error)
	GetProjects(ctx context.Context, offset int, limit int, opts ...ProjectOption) (Projects, error)
	GetMessageAuthorUID(ctx context.Context, id int64) (uint, error)
	Messages(ctx context.Context, id uuid.UUID) (ProjectMessages, error)
	CreateMessage(ctx context.Context, id uuid.UUID, authorUID uint, content string, replyToID *int64) error
	EditMessage(ctx context.Context, id uuid.UUID, m_id int64, content string) error
	DeleteMessage(ctx context.Context, id uuid.UUID, m_id int64) error
	GetCategories(ctx context.Context) ([]string, error)
	CreateProject(ctx context.Context, project Project) (*uuid.UUID, error)
	AddProjectPhoto(ctx context.Context, projectID uuid.UUID, key string, contentType string, sizeBytes int) error
	ToggleLike(ctx context.Context, id uuid.UUID, userID uint) error
}
