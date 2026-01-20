package grpcserver_test

import (
	"context"
	"testing"

	storageapp "Aesterial/backend/internal/app/storage"
	storagepb "Aesterial/backend/internal/gen/storage/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
)

func TestStorageServiceReceiveGetPresignNotConfigured(t *testing.T) {
	svc := grpcserver.NewStorageService(nil)
	_, err := svc.ReceiveGetPresign(context.Background(), &storagepb.PresignGetRequest{Key: "avatars/1/current"})
	assertAppError(t, err, apperrors.NotConfigured)
}

func TestStorageServiceReceiveGetPresignSuccess(t *testing.T) {
	storageSvc, err := storageapp.New()
	if err != nil {
		t.Fatalf("failed to create storage service: %v", err)
	}
	svc := grpcserver.NewStorageService(storageSvc)
	resp, err := svc.ReceiveGetPresign(context.Background(), &storagepb.PresignGetRequest{Key: "avatars/1/current"})
	if err != nil {
		t.Fatalf("ReceiveGetPresign() error: %v", err)
	}
	if resp == nil || resp.Presign == "" {
		t.Fatalf("expected presign url, got %+v", resp)
	}
}
