package login

import (
	"context"
)

type Repository interface {
	Register(ctx context.Context, user RegisterRequire) (*int, error)
	Authorization(ctx context.Context, user AuthorizationRequire) (*int, error)
}
