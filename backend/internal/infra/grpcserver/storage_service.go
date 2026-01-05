package grpcserver

import (
	storageapp "ascendant/backend/internal/app/storage"
	storagepb "ascendant/backend/internal/gen/storage/v1"
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type StorageService struct {
	storagepb.UnimplementedStorageServer
	storage *storageapp.Service
}

func NewStorageService(storage *storageapp.Service) *StorageService {
	return &StorageService{storage: storage}
}

func (s *StorageService) ReceiveGetPresign(ctx context.Context, req *storagepb.PresignGetRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, status.Error(codes.Internal, "storage service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	key := strings.TrimSpace(req.Key)
	if key == "" {
		return nil, status.Error(codes.InvalidArgument, "key is empty")
	}
	url, err := s.storage.PresignGet(ctx, key)
	if err != nil {
		return nil, statusFromError(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) ReceivePutPresign(ctx context.Context, req *storagepb.PresignPutRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, status.Error(codes.Internal, "storage service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	key := strings.TrimSpace(req.Key)
	if key == "" {
		return nil, status.Error(codes.InvalidArgument, "key is empty")
	}
	url, err := s.storage.PresignPut(ctx, key, req.ContentType)
	if err != nil {
		return nil, statusFromError(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) GetUserAvatarPresign(ctx context.Context, req *storagepb.UserAvatarRequest) (*storagepb.PresignResponse, error) {
	if s == nil || s.storage == nil {
		return nil, status.Error(codes.Internal, "storage service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	key, err := s.storage.UserAvatarKey(req.UserID, req.PicID)
	if err != nil {
		return nil, statusFromError(err)
	}
	url, err := s.storage.PresignGet(ctx, key)
	if err != nil {
		return nil, statusFromError(err)
	}
	return &storagepb.PresignResponse{
		Presign: url,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}

func (s *StorageService) ListProjectAvatars(ctx context.Context, req *storagepb.ProjectAvatarsRequest) (*storagepb.ProjectAvatarsResponse, error) {
	if s == nil || s.storage == nil {
		return nil, status.Error(codes.Internal, "storage service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}
	ids, err := s.storage.ListProjectAvatarIDs(ctx, req.ProjectID)
	if err != nil {
		return nil, statusFromError(err)
	}
	return &storagepb.ProjectAvatarsResponse{
		PicIDs:  ids,
		Tracing: TraceIDOrNew(ctx),
	}, nil
}
