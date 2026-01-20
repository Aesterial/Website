package grpcserver_test

import (
	"context"
	"errors"
	"testing"

	maintenanceapp "Aesterial/backend/internal/app/maintenance"
	maintdomain "Aesterial/backend/internal/domain/maintenance"
	maintpb "Aesterial/backend/internal/gen/maintenance/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	apperrors "Aesterial/backend/internal/shared/errors"
	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/emptypb"
)

type maintenanceRepoStub struct {
	getDataErr error
}

func (m *maintenanceRepoStub) CheckIsActive(context.Context) (bool, error) {
	return false, nil
}

func (m *maintenanceRepoStub) SetActive(context.Context, uuid.UUID) error {
	return nil
}

func (m *maintenanceRepoStub) IsPlanned(context.Context) (bool, error) {
	return false, nil
}

func (m *maintenanceRepoStub) GetData(context.Context) (*maintdomain.Information, error) {
	if m.getDataErr != nil {
		return nil, m.getDataErr
	}
	return &maintdomain.Information{}, nil
}

func (m *maintenanceRepoStub) GetList(context.Context) (maintdomain.Informations, error) {
	return nil, nil
}

func (m *maintenanceRepoStub) Start(context.Context, maintdomain.CreateST, uint) error {
	return nil
}

func (m *maintenanceRepoStub) Edit(context.Context, maintdomain.EditST) error {
	return nil
}

func (m *maintenanceRepoStub) Complete(context.Context) error {
	return nil
}

func TestMaintenanceServiceDataUnavailable(t *testing.T) {
	repo := &maintenanceRepoStub{getDataErr: errors.New("maintenance is not active")}
	svc := grpcserver.NewMaintenanceService(maintenanceapp.New(repo), nil, nil)

	_, err := svc.Data(context.Background(), &emptypb.Empty{})
	assertAppError(t, err, apperrors.Unavailable)
}

func TestMaintenanceServiceStartUnauthenticated(t *testing.T) {
	repo := &maintenanceRepoStub{}
	svc := grpcserver.NewMaintenanceService(maintenanceapp.New(repo), nil, nil)

	_, err := svc.Start(context.Background(), &maintpb.CreateRequest{})
	assertAppError(t, err, apperrors.Unauthenticated)
}
