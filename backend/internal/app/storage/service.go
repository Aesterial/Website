package storage

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"path"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awscfg "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
)

const (
	defaultPresignTTL = 15 * time.Minute
	defaultRegion     = "eu-central-1"
	avatarsPrefix     = "avatars"
	photosPrefix      = "photos"
	defaultAvatarID   = "current"
)

type Service struct {
	bucket     string
	presignTTL time.Duration
	client     *s3.Client
	presigner  *s3.PresignClient
}

func New() (*Service, error) {
	env := config.Get()
	cfg := env.Storage

	bucket := strings.TrimSpace(cfg.Bucket)
	if bucket == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("storage bucket is empty")
	}

	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = defaultRegion
	}

	endpoint := normalizeEndpoint(cfg.Endpoint, cfg.UseSSL)

	opts := []func(*awscfg.LoadOptions) error{
		awscfg.WithRegion(region),
	}

	if cfg.AccessKey != "" || cfg.SecretKey != "" {
		opts = append(opts, awscfg.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		))
	}

	if endpoint != "" {
		opts = append(opts, awscfg.WithEndpointResolverWithOptions(
			aws.EndpointResolverWithOptionsFunc(func(service, region string, _ ...interface{}) (aws.Endpoint, error) {
				if service == s3.ServiceID {
					return aws.Endpoint{
						URL:           endpoint,
						SigningRegion: region,
					}, nil
				}
				return aws.Endpoint{}, &aws.EndpointNotFoundError{}
			}),
		))
	}

	awsCfg, err := awscfg.LoadDefaultConfig(context.Background(), opts...)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "storage.new")
		return nil, apperrors.Wrap(err)
	}

	s3Client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.ForcePathStyle
	})

	ttl := time.Duration(cfg.PresignTTLSeconds) * time.Second
	if ttl <= 0 {
		ttl = defaultPresignTTL
	}

	return &Service{
		bucket:     bucket,
		presignTTL: ttl,
		client:     s3Client,
		presigner:  s3.NewPresignClient(s3Client),
	}, nil
}

func (s *Service) PresignGet(ctx context.Context, key string) (string, error) {
	if s == nil || s.presigner == nil {
		return "", apperrors.NotConfigured
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	out, err := s.presigner.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(s.presignTTL))
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "storage.presign_get")
		return "", apperrors.Wrap(err)
	}
	return out.URL, nil
}

func (s *Service) PresignPut(ctx context.Context, key, contentType string) (string, error) {
	if s == nil || s.presigner == nil {
		return "", apperrors.NotConfigured
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	input := &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}
	contentType = strings.TrimSpace(contentType)
	if contentType != "" {
		input.ContentType = aws.String(contentType)
	}
	out, err := s.presigner.PresignPutObject(ctx, input, s3.WithPresignExpires(s.presignTTL))
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "storage.presign_put")
		return "", apperrors.Wrap(err)
	}
	return out.URL, nil
}

func (s *Service) Exists(ctx context.Context, key string) (bool, error) {
	if s == nil || s.client == nil {
		return false, apperrors.NotConfigured
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return false, apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFound(err) {
			return false, nil
		}
		logger.Debug("error appeared: "+err.Error(), "storage.exists")
		return false, apperrors.Wrap(err)
	}
	return true, nil
}

func (s *Service) Delete(ctx context.Context, key string) error {
	if s == nil || s.client == nil {
		return apperrors.NotConfigured
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("key is empty")
	}
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isNotFound(err) {
			return nil
		}
		logger.Debug("error appeared: "+err.Error(), "storage.delete")
		return apperrors.Wrap(err)
	}
	return nil
}

func (s *Service) UserAvatarKey(userID, picID string) (string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("user id is empty")
	}
	picID = strings.TrimSpace(picID)
	if picID == "" {
		picID = defaultAvatarID
	}
	return avatarsPrefix + "/" + userID + "/" + picID, nil
}

func (s *Service) ListProjectAvatarIDs(ctx context.Context, projectID string) ([]string, error) {
	if s == nil || s.client == nil {
		return nil, apperrors.NotConfigured
	}
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("project id is empty")
	}
	prefix := photosPrefix + "/" + projectID + "/"
	return s.listIDs(ctx, prefix)
}

func (s *Service) listIDs(ctx context.Context, prefix string) ([]string, error) {
	p := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})

	unique := make(map[string]struct{})
	for p.HasMorePages() {
		page, err := p.NextPage(ctx)
		if err != nil {
			logger.Debug("error appeared: "+err.Error(), "storage.list_ids.page")
			return nil, apperrors.Wrap(err)
		}
		for _, obj := range page.Contents {
			if obj.Key == nil {
				continue
			}
			key := strings.TrimPrefix(aws.ToString(obj.Key), prefix)
			if key == "" {
				continue
			}
			base := path.Base(key)
			id := strings.TrimSuffix(base, path.Ext(base))
			if id == "" {
				continue
			}
			unique[id] = struct{}{}
		}
	}

	if len(unique) == 0 {
		return []string{}, nil
	}

	ids := make([]string, 0, len(unique))
	for id := range unique {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids, nil
}

func normalizeEndpoint(endpoint string, useSSL bool) string {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return ""
	}
	if strings.Contains(endpoint, "://") {
		return endpoint
	}
	scheme := "http"
	if useSSL {
		scheme = "https"
	}
	return scheme + "://" + endpoint
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	var apiErr smithy.APIError
	if errors.As(err, &apiErr) {
		code := strings.ToLower(strings.TrimSpace(apiErr.ErrorCode()))
		if code == "notfound" || code == "nosuchkey" || code == "404" {
			return true
		}
	}
	raw := strings.ToLower(err.Error())
	return strings.Contains(raw, "notfound") || strings.Contains(raw, "no such key") || strings.Contains(raw, "status code: 404")
}
