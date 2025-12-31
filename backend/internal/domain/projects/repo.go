package projects

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	GetProject(ctx context.Context, id uuid.UUID) (*Project, error)
	GetProjectsByUID(ctx context.Context, uid int) ([]*Project, error)
}
