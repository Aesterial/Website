package rank

import (
	"Aesterial/backend/internal/domain/permissions"
	"context"
)

type Repository interface {
	Create(ctx context.Context, name string, color int, description string, perms ...permissions.Permissions) error
	Edit(ctx context.Context, rank string, what string, data any) error
	Delete(ctx context.Context, rank string) error
	Get(ctx context.Context, rank string) (*Rank, error)
	List(ctx context.Context) ([]*Rank, error)
	UsersWithRank(ctx context.Context, name string) ([]*uint, error)
	Perms(ctx context.Context, rank string) (*permissions.Permissions, error)
	ChangePerms(ctx context.Context, rank string, perm permissions.Permission, state bool) error
	IsExists(ctx context.Context, rank string) (bool, error)
	CanEdit(ctx context.Context, current string, target string) (bool, error)
}
