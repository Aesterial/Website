package grpcserver

import (
	"Aesterial/backend/internal/app/config"
	storageapp "Aesterial/backend/internal/app/storage"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	"context"
	"strings"
	"sync"
)

const defaultPresignWorkers = 16

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
	if storage == nil || len(projects) == 0 {
		return
	}
	keys := uniqueProjectMediaKeys(projects)
	if len(keys) == 0 {
		return
	}

	urls := presignURLMap(ctx, storage, keys)
	if len(urls) == 0 {
		return
	}

	for _, project := range projects {
		applyPresignedProjectURLsFromMap(project, urls)
	}
}

func uniqueProjectMediaKeys(projects []*projpb.Project) []string {
	keys := make(map[string]struct{})
	for _, project := range projects {
		if project == nil {
			continue
		}
		addAvatarKey(keys, project.GetAuthor().GetSettings().GetAvatar())
		for _, liked := range project.GetLiked() {
			addAvatarKey(keys, liked.GetSettings().GetAvatar())
		}
		for _, photo := range project.GetDetails().GetPhotos() {
			addAvatarKey(keys, photo)
		}
	}
	if len(keys) == 0 {
		return nil
	}
	result := make([]string, 0, len(keys))
	for key := range keys {
		result = append(result, key)
	}
	return result
}

func addAvatarKey(keys map[string]struct{}, avatar *userpb.Avatar) {
	if avatar == nil {
		return
	}
	key := strings.TrimSpace(avatar.GetKey())
	if key == "" {
		return
	}
	keys[key] = struct{}{}
}

func presignURLMap(ctx context.Context, storage *storageapp.Service, keys []string) map[string]string {
	maxWorkers := mediaPresignWorkers()
	workers := min(len(keys), maxWorkers)
	if workers < 1 {
		workers = 1
	}

	type pair struct {
		key string
		url string
	}

	in := make(chan string)
	out := make(chan pair, len(keys))
	var wg sync.WaitGroup

	for i := 0; i < workers; i++ {
		wg.Go(func() {
			for key := range in {
				url, err := storage.PresignGet(ctx, key)
				if err != nil || strings.TrimSpace(url) == "" {
					continue
				}
				out <- pair{key: key, url: url}
			}
		})
	}

	for _, key := range keys {
		in <- key
	}
	close(in)
	wg.Wait()
	close(out)

	urls := make(map[string]string, len(keys))
	for item := range out {
		urls[item.key] = item.url
	}
	return urls
}

func mediaPresignWorkers() int {
	workers := config.Get().Async.MediaPresignWorkers
	if workers < 1 {
		return defaultPresignWorkers
	}
	return workers
}

func applyPresignedProjectURLsFromMap(project *projpb.Project, urls map[string]string) {
	if project == nil || len(urls) == 0 {
		return
	}
	applyPresignedAvatarURLFromMap(project.GetAuthor().GetSettings().GetAvatar(), urls)
	for _, liked := range project.GetLiked() {
		applyPresignedAvatarURLFromMap(liked.GetSettings().GetAvatar(), urls)
	}
	for _, photo := range project.GetDetails().GetPhotos() {
		applyPresignedAvatarURLFromMap(photo, urls)
	}
}

func applyPresignedAvatarURLFromMap(avatar *userpb.Avatar, urls map[string]string) {
	if avatar == nil {
		return
	}
	key := strings.TrimSpace(avatar.GetKey())
	if key == "" {
		return
	}
	url, ok := urls[key]
	if !ok || strings.TrimSpace(url) == "" {
		return
	}
	avatar.Url = url
	avatar.Key = ""
}
