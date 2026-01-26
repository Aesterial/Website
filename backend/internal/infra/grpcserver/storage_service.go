package grpcserver

import (
	projectsapp "Aesterial/backend/internal/app/projects"
	storageapp "Aesterial/backend/internal/app/storage"
	storagepb "Aesterial/backend/internal/gen/storage/v1"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"

	"github.com/google/uuid"
)

type StorageService struct {
	storagepb.UnimplementedStorageServiceServer
	storage  *storageapp.Service
	projects *projectsapp.Service
}

func NewStorageService(storage *storageapp.Service, projects *projectsapp.Service) *StorageService {
	return &StorageService{storage: storage, projects: projects}
}

func (s *StorageService) ReceiveGetPresign(ctx context.Context, req *storagepb.PresignGetRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	key := strings.TrimSpace(req.Key)
	if key == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	url, err := s.storage.PresignGet(ctx, key)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) ReceivePutPresign(ctx context.Context, req *storagepb.PresignPutRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	key := strings.TrimSpace(req.Key)
	if key == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	if err := s.registerProjectPhoto(ctx, key, req.ContentType); err != nil {
		return nil, apperrors.Wrap(err)
	}
	url, err := s.storage.PresignPut(ctx, key, req.ContentType)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) GetUserAvatarPresign(ctx context.Context, req *storagepb.UserAvatarRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	key, err := s.storage.UserAvatarKey(req.UserID, req.PicID)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	url, err := s.storage.PresignGet(ctx, key)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) ListProjectAvatars(ctx context.Context, req *storagepb.ProjectAvatarsRequest) (*storagepb.ProjectAvatarsResponse, error) {
	if s == nil || s.storage == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	ids, err := s.storage.ListProjectAvatarIDs(ctx, req.ProjectID)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	return &storagepb.ProjectAvatarsResponse{
		PicIDs:  ids,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) registerProjectPhoto(ctx context.Context, key string, contentType string) error {
	projectID, ok := parseProjectPhotoKey(key)
	if !ok {
		return nil
	}
	if s.projects == nil {
		return apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	return s.projects.AddProjectPhoto(ctx, projectID, key, contentType, 0)
}

func parseProjectPhotoKey(key string) (uuid.UUID, bool) {
	key = strings.TrimSpace(key)
	if key == "" {
		return uuid.Nil, false
	}
	parts := strings.Split(key, "/")
	if len(parts) < 3 {
		return uuid.Nil, false
	}
	if parts[0] != "photos" {
		return uuid.Nil, false
	}
	projectID := strings.TrimSpace(parts[1])
	if projectID == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(projectID)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}
