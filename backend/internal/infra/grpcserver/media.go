package grpcserver

import (
	storageapp "Aesterial/backend/internal/app/storage"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"context"
	"strings"
)

func applyPresignedAvatarURL(ctx context.Context, storage *storageapp.Service, avatar *userpb.Avatar) {
	if storage == nil || avatar == nil {
		return
	}
	key := strings.TrimSpace(avatar.Key)
	if key == "" {
		return
	}
	url, err := storage.PresignGet(ctx, key)
	if err != nil || strings.TrimSpace(url) == "" {
		return
	}
	avatar.Url = url
	avatar.Key = ""
}

func applyPresignedUserAvatarURL(ctx context.Context, storage *storageapp.Service, u *userpb.UserPublic) {
	if u == nil || u.Settings == nil || u.Settings.Avatar == nil {
		return
	}
	applyPresignedAvatarURL(ctx, storage, u.Settings.Avatar)
}

func applyPresignedProjectURLs(ctx context.Context, storage *storageapp.Service, project *projpb.Project) {
	if project == nil {
		return
	}
	applyPresignedUserAvatarURL(ctx, storage, project.Author)
	for _, liked := range project.Liked {
		applyPresignedUserAvatarURL(ctx, storage, liked)
	}
	if project.Details == nil {
		return
	}
	for _, photo := range project.Details.Photos {
		applyPresignedAvatarURL(ctx, storage, photo)
	}
}

func applyPresignedProjectsURLs(ctx context.Context, storage *storageapp.Service, projects []*projpb.Project) {
	for _, project := range projects {
		applyPresignedProjectURLs(ctx, storage, project)
	}
}
