package grpcserver

import (
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/app/verification"
	notifypb "Aesterial/backend/internal/gen/notifications/v1"
	"context"

	"google.golang.org/protobuf/types/known/emptypb"
)

type NotificationService struct {
	notifypb.UnimplementedNotificationServiceServer
	auth         *Authenticator
	verification *verification.Service
	storage      *storageapp.Service
}

func (s *NotificationService) All(ctx context.Context, _ *emptypb.Empty) (*notifypb.AllResponse, error) {
	return nil, nil
}
