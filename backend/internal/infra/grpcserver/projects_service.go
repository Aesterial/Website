package grpcserver

import (
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	projectsapp "ascendant/backend/internal/app/projects"
	permsdomain "ascendant/backend/internal/domain/permissions"
	projectsdomain "ascendant/backend/internal/domain/projects"
	"ascendant/backend/internal/domain/user"
	projpb "ascendant/backend/internal/gen/projects/v1"
	"ascendant/backend/internal/infra/logger"
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

const (
	projectCategoryImprovement   = "\u0431\u043B\u0430\u0433\u043E\u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E"
	projectCategoryRoadsSidewalk = "\u0434\u043E\u0440\u043E\u0433\u0438 \u0438 \u0442\u0440\u043E\u0442\u0443\u0430\u0440\u044B"
	projectCategoryLighting      = "\u043E\u0441\u0432\u0435\u0449\u0435\u043D\u0438\u0435"
	projectCategoryPlaygrounds   = "\u0434\u0435\u0442\u0441\u043A\u0438\u0435 \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0438"
	projectCategoryParks         = "\u043F\u0430\u0440\u043A\u0438 \u0438 \u0441\u043A\u0432\u0435\u0440\u044B"
	projectCategoryOther         = "\u0434\u0440\u0443\u0433\u043E\u0435"
)

type ProjectService struct {
	projpb.UnimplementedProjectServiceServer
	projects *projectsapp.Service
	auth     *Authenticator
}

func NewProjectService(projects *projectsapp.Service, sess *sessionsapp.Service, perms *permissionsapp.Service, us *userapp.Service) *ProjectService {
	return &ProjectService{
		projects: projects,
		auth:     NewAuthenticator(sess, perms, us),
	}
}

func (s *ProjectService) Create(ctx context.Context, req *projpb.CreateRequest) (*projpb.EmptyResponse, error) {
	if s == nil || s.projects == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is empty")
	}

	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.CreateIdea); err != nil {
		return nil, err
	}

	var project projectsdomain.Project
	project.Author = &user.User{UID: requestor.UID}
	project.Info.Title = strings.TrimSpace(req.Title)
	if project.Info.Title == "" {
		return nil, status.Error(codes.InvalidArgument, "title is empty")
	}
	if req.Description != nil {
		project.Info.Description = strings.TrimSpace(*req.Description)
	}
	project.Info.Category = projectsdomain.ProjectCategory(normalizeProjectCategory(req.Category))
	if project.Info.Category == "" {
		return nil, status.Error(codes.InvalidArgument, "category is empty")
	}
	if req.Location != nil {
		project.Info.Location.City = strings.TrimSpace(req.Location.City)
		project.Info.Location.Street = strings.TrimSpace(req.Location.Street)
		project.Info.Location.House = strings.TrimSpace(req.Location.House)
	}
	for _, photo := range req.Photos {
		avatar := fromProtoAvatar(photo)
		if avatar == nil {
			continue
		}
		project.Info.Photos = append(project.Info.Photos, avatar)
	}

	if err := s.projects.CreateProject(ctx, project); err != nil {
		return nil, statusFromError(err)
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Project created", "projects.create.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &projpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *ProjectService) Categories(ctx context.Context, _ *emptypb.Empty) (*projpb.CategoriesResponse, error) {
	if s == nil || s.projects == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	_ = requestor
	var resp projpb.CategoriesResponse
	resp.Categories, err = s.projects.GetCategories(ctx)
	if err != nil {
		return nil, err
	}
	resp.Tracing = TraceIDOrNew(ctx)
	return &resp, nil
}

func (s *ProjectService) Get(ctx context.Context, req *projpb.GetRequest) (*projpb.GetResponse, error) {
	if s == nil || s.projects == nil {
		return nil, status.Error(codes.Internal, "projects service not configured")
	}
	trace := TraceIDOrNew(ctx)
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	logger.Info("Requested list of projects", "projects.list.get", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, trace)
	list, err := s.projects.GetProjects(ctx, int(req.Offset), int(req.Limit))
	if err != nil {
		return nil, err
	}
	return &projpb.GetResponse{Projects: list.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
}

func normalizeProjectCategory(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	switch strings.ToLower(trimmed) {
	case "improvement", "landscaping", projectCategoryImprovement:
		return projectCategoryImprovement
	case "roadsidewalks", "roadsandsidewalks", "roads_and_sidewalks", projectCategoryRoadsSidewalk:
		return projectCategoryRoadsSidewalk
	case "lighting", projectCategoryLighting:
		return projectCategoryLighting
	case "playgrounds", projectCategoryPlaygrounds:
		return projectCategoryPlaygrounds
	case "parks", "parksandsquares", "parks_and_squares", projectCategoryParks:
		return projectCategoryParks
	case "other", projectCategoryOther:
		return projectCategoryOther
	default:
		return trimmed
	}
}
