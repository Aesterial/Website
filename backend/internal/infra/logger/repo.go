package logger

import "context"

type Repository interface {
	Append(ctx context.Context, event Event) error
	GetList(ctx context.Context, limit uint, offset uint) ([]*Event, error)
}
