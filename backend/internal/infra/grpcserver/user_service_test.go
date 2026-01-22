package grpcserver_test

import (
	"testing"

	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestUserServiceSelf(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	svc := grpcserver.NewUserService(userSvc, nil, sessionsSvc, nil)

	resp, err := svc.Self(ctx, &emptypb.Empty{})
	if err != nil {
		t.Fatalf("Self() error: %v", err)
	}
	if resp == nil || resp.Data == nil || resp.Tracing == "" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestUserServiceOtherNilRequest(t *testing.T) {
	ctx, sessionsSvc, userSvc, _, _ := newAuthDeps(t, 10)
	svc := grpcserver.NewUserService(userSvc, nil, sessionsSvc, nil)

	_, err := svc.Other(ctx, nil)
	assertAppError(t, err, apperrors.RequiredDataMissing)
}

func TestUserServiceDeleteSelfAvatarNotImplemented(t *testing.T) {
	svc := grpcserver.NewUserService(nil, nil, nil, nil)
	_, err := svc.DeleteSelfAvatar(nil, &emptypb.Empty{})
	assertAppError(t, err, apperrors.NotConfigured)
}
