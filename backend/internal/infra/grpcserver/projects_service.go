package grpcserver

import (
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	projectsapp "Aesterial/backend/internal/app/projects"
	storageapp "Aesterial/backend/internal/app/storage"
	"Aesterial/backend/internal/domain/permissions"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	projectsdomain "Aesterial/backend/internal/domain/projects"
	"Aesterial/backend/internal/domain/user"
	projpb "Aesterial/backend/internal/gen/projects/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"strings"

	"github.com/google/uuid"
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
	storage  *storageapp.Service
}

func NewProjectService(projects *projectsapp.Service, sess *sessionsapp.Service, us *userapp.Service, storage *storageapp.Service) *ProjectService {
	return &ProjectService{
		projects: projects,
		auth:     NewAuthenticator(sess, us),
		storage:  storage,
	}
}

func (s *ProjectService) Create(ctx context.Context, req *projpb.CreateRequest) (*projpb.EmptyResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}

	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.ProjectsCreate); err != nil {
		return nil, err
	}

	var project projectsdomain.Project
	project.Author = &user.User{UID: requestor.UID}
	project.Info.Title = strings.TrimSpace(req.Title)
	if project.Info.Title == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("title is empty")
	}
	if req.Description != nil {
		project.Info.Description = strings.TrimSpace(*req.Description)
	}
	project.Info.Category = projectsdomain.ProjectCategory(normalizeProjectCategory(req.Category))
	if project.Info.Category == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("category is empty")
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
		key := strings.TrimSpace(avatar.Key)
		if key == "" {
			return nil, apperrors.RequiredDataMissing.AddErrDetails("photo key is empty")
		}
		if s.storage == nil {
			return nil, apperrors.NotConfigured.AddErrDetails("storage service not configured")
		}
		exists, err := s.storage.Exists(ctx, key)
		if err != nil {
			return nil, apperrors.ServerError.AddErrDetails("failed to validate project photo object")
		}
		if !exists {
			return nil, apperrors.RecordNotFound.AddErrDetails("project photo object not found")
		}
		project.Info.Photos = append(project.Info.Photos, avatar)
	}

	if err := s.projects.CreateProject(ctx, project); err != nil {
		return nil, apperrors.Wrap(err)
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Project created", "projects.create.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &projpb.EmptyResponse{Tracing: traceID}, nil
}

func (s *ProjectService) Categories(ctx context.Context, _ *emptypb.Empty) (*projpb.CategoriesResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.ProjectsView); err != nil {
		return nil, err
	}
	var resp projpb.CategoriesResponse
	resp.Categories, err = s.projects.GetCategories(ctx)
	if err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got project categories", "projects.categories.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	resp.Tracing = traceID
	return &resp, nil
}

func (s *ProjectService) Get(ctx context.Context, req *projpb.GetRequest) (*projpb.GetResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	trace := TraceIDOrNew(ctx)
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.ProjectsView); err != nil {
		return nil, err
	}
	logger.Info("Requested list of projects", "projects.list.get", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, trace)
	list, err := s.projects.GetProjects(ctx, int(req.Offset), int(req.Limit), projectsdomain.WithStatuses(projectsdomain.InProgress.String(), projectsdomain.Published.String()))
	if err != nil {
		return nil, err
	}
	projects := list.ToProto()
	applyPresignedProjectsURLs(ctx, s.storage, projects)
	return &projpb.GetResponse{Projects: projects, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *ProjectService) ByUID(ctx context.Context, req *projpb.MadeByRequest) (*projpb.GetResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil {
		return nil, err
	}
	if requestor == nil {
		return nil, apperrors.Unauthenticated.AddErrDetails("user not logon")
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permissions.UsersViewProfilePublic); err != nil {
		return nil, err
	}
	list, err := s.projects.GetProjectsByUID(ctx, int(req.UserId))
	if err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got projects by user ID", "projects.by_uid.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &projpb.GetResponse{Projects: list.ToProto(), Tracing: traceID}, nil
}

func (s *ProjectService) GetArchived(ctx context.Context, req *projpb.GetRequest) (*projpb.GetResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	trace := TraceIDOrNew(ctx)
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.ProjectsView); err != nil {
		return nil, err
	}
	logger.Info("Requested list of archived projects", "projects.list.get", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, trace)
	list, err := s.projects.GetArchivedProjects(ctx, int(req.Offset), int(req.Limit))
	if err != nil {
		return nil, err
	}
	projects := list.ToProto()
	applyPresignedProjectsURLs(ctx, s.storage, projects)
	return &projpb.GetResponse{Projects: projects, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *ProjectService) ToggleLike(ctx context.Context, req *projpb.LikeRequest) (*projpb.EmptyResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	trace := TraceIDOrNew(ctx)
	requestor, err := s.auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	if err := s.auth.RequirePermissions(ctx, requestor.UID, permsdomain.ProjectsVote); err != nil {
		return nil, err
	}
	id, err := uuid.Parse(req.Id)
	if err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails(err.Error())
	}
	logger.Info("Toggled like for project with ID: "+id.String(), "projects.like.toggle", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, trace)
	if err := s.projects.ToggleLike(ctx, id, requestor.UID); err != nil {
		return nil, err
	}
	return &projpb.EmptyResponse{Tracing: trace}, nil
}

func (s *ProjectService) GetTop(ctx context.Context, req *projpb.GetTopRequest) (*projpb.GetResponse, error) {
	if s == nil || s.projects == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("projects service not configured")
	}
	proj, err := s.projects.GetTopProjects(ctx, int(req.GetLimit()), req.GetCity())
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get projects top list: " + err.Error() + "for city: " + req.GetCity())
	}
	return &projpb.GetResponse{Projects: proj.ToProto(), Tracing: TraceIDOrNew(ctx)}, nil
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
