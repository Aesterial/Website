package permissions

import "context"

type Repository interface {
	GetForRank(ctx context.Context, rank string) (*Permissions, error)
	GetForUser(ctx context.Context, uid uint) (*Permissions, error)
	Has(ctx context.Context, uid uint, need Permission) (bool, error)
	HasAll(ctx context.Context, uid uint, need ...Permission) (bool, error)
	ChangeForUser(ctx context.Context, uid uint, need Permission, state bool) error
	ChangeForRank(ctx context.Context, rank string, need Permission, state bool) error
}
