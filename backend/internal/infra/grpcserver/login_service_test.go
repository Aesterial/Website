package grpcserver_test

import (
	"ascendant/backend/internal/domain/permissions"
	userpb "ascendant/backend/internal/gen/user/v1"
	"context"
	"testing"
	"time"

	loginapp "ascendant/backend/internal/app/auth"
	permsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userinfo "ascendant/backend/internal/app/info/user"
	logindomain "ascendant/backend/internal/domain/login"
	rankdomain "ascendant/backend/internal/domain/rank"
	sessionsdomain "ascendant/backend/internal/domain/sessions"
	userdomain "ascendant/backend/internal/domain/user"
	loginpb "ascendant/backend/internal/gen/login/v1"
	grpcserver "ascendant/backend/internal/infra/grpcserver"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func TestRegister(t *testing.T) {
	t.Setenv("COOKIES_SECRET", "test-secret")
	t.Setenv("COOKIES_NAME", "ascendant_session")

	loginRepo := &loginRepoStub{registerUID: 42}
	sessionsRepo := &sessionsRepoStub{}
	userRepo := &userRepoStub{}
	permsRepo := &permsRepoStub{}

	service := newLoginService(loginRepo, sessionsRepo, userRepo, permsRepo)
	ctx, _ := newTestContext("/login.v1.LoginService/Register")

	resp, err := service.Register(ctx, &loginpb.RegisterRequest{
		Username: "admin1",
		Email:    "admin1@test.com",
		Password: "admin1_password",
	})
	if err != nil {
		t.Fatalf("Register() error: %v", err)
	}
	if got := resp.GetData(); got != "success" {
		t.Fatalf("unexpected response data: got %q, want %q", got, "success")
	}
	if resp.GetTracing() == "" {
		t.Fatalf("expected tracing id in response")
	}
	if sessionsRepo.addCalls != 1 {
		t.Fatalf("expected AddSession to be called once, got %d", sessionsRepo.addCalls)
	}
}

func TestAuthorization(t *testing.T) {
	t.Setenv("COOKIES_SECRET", "test-secret")
	t.Setenv("COOKIES_NAME", "ascendant_session")

	loginRepo := &loginRepoStub{authUID: 7}
	sessionsRepo := &sessionsRepoStub{}
	userRepo := &userRepoStub{}
	permsRepo := &permsRepoStub{}

	service := newLoginService(loginRepo, sessionsRepo, userRepo, permsRepo)
	ctx, _ := newTestContext("/login.v1.LoginService/Authorization")

	resp, err := service.Authorization(ctx, &loginpb.AuthRequest{
		Usermail: "admin1",
		Password: "admin1_password",
	})
	if err != nil {
		t.Fatalf("Authorization() error: %v", err)
	}
	if got := resp.GetData(); got != "success" {
		t.Fatalf("unexpected response data: got %q, want %q", got, "success")
	}
	if resp.GetTracing() == "" {
		t.Fatalf("expected tracing id in response")
	}
	if sessionsRepo.addCalls != 1 {
		t.Fatalf("expected AddSession to be called once, got %d", sessionsRepo.addCalls)
	}
}

func newLoginService(repo logindomain.Repository, sessionsRepo sessionsdomain.Repository, userRepo userdomain.Repository, permsRepo permissions.Repository) *grpcserver.LoginService {
	sessionsService := sessionsapp.New(sessionsRepo)
	userService := userinfo.New(userRepo, sessionsRepo)
	loginService := loginapp.New(repo, sessionsService, userService)
	permsService := permsapp.New(permsRepo)
	return grpcserver.NewLoginService(loginService, sessionsService, permsService)
}

func newTestContext(method string) (context.Context, *transportStreamStub) {
	stream := &transportStreamStub{method: method}
	ctx := grpc.NewContextWithServerTransportStream(context.Background(), stream)
	return ctx, stream
}

type transportStreamStub struct {
	method  string
	header  metadata.MD
	trailer metadata.MD
}

func (s *transportStreamStub) Method() string {
	return s.method
}

func (s *transportStreamStub) SetHeader(md metadata.MD) error {
	s.header = metadata.Join(s.header, md)
	return nil
}

func (s *transportStreamStub) SendHeader(md metadata.MD) error {
	return s.SetHeader(md)
}

func (s *transportStreamStub) SetTrailer(md metadata.MD) error {
	s.trailer = metadata.Join(s.trailer, md)
	return nil
}

type loginRepoStub struct {
	authUID     uint
	registerUID uint
	authErr     error
	registerErr error
}

func (r *loginRepoStub) Authorization(ctx context.Context, user logindomain.AuthorizationRequire) (*uint, error) {
	if r.authErr != nil {
		return nil, r.authErr
	}
	uid := r.authUID
	return &uid, nil
}

func (r *loginRepoStub) Register(ctx context.Context, user logindomain.RegisterRequire) (*uint, error) {
	if r.registerErr != nil {
		return nil, r.registerErr
	}
	uid := r.registerUID
	return &uid, nil
}

func (r *loginRepoStub) Logout(ctx context.Context, sessionID uuid.UUID) error {
	return r.registerErr
}

type sessionsRepoStub struct {
	addCalls int
}

func (s *sessionsRepoStub) IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	return true, nil
}

func (s *sessionsRepoStub) GetSession(ctx context.Context, sessionID uuid.UUID) (*sessionsdomain.Session, error) {
	return nil, nil
}

func (s *sessionsRepoStub) GetSessions(ctx context.Context, uid uint) ([]*sessionsdomain.Session, error) {
	return nil, nil
}

func (s *sessionsRepoStub) GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error) {
	return nil, nil
}

func (s *sessionsRepoStub) SetRevoked(ctx context.Context, sessionID uuid.UUID) error {
	return nil
}

func (s *sessionsRepoStub) AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error {
	s.addCalls++
	return nil
}

func (s *sessionsRepoStub) UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error {
	return nil
}

type userRepoStub struct {
	sessionLive time.Duration
}

func (u *userRepoStub) GetList(ctx context.Context) ([]*userpb.UserSelf, error) {
	return nil, nil
}

func (u *userRepoStub) GetUID(ctx context.Context, username string) (uint, error) {
	return 0, nil
}

func (u *userRepoStub) GetUsername(ctx context.Context, uid uint) (string, error) {
	return "", nil
}

func (u *userRepoStub) GetEmail(ctx context.Context, uid uint) (*userdomain.Email, error) {
	return nil, nil
}

func (u *userRepoStub) GetRank(ctx context.Context, uid uint) (*rankdomain.Rank, error) {
	return nil, nil
}

func (u *userRepoStub) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	return nil, nil
}

func (u *userRepoStub) GetSettings(ctx context.Context, uid uint) (*userdomain.Settings, error) {
	return nil, nil
}

func (u *userRepoStub) GetUserByUID(ctx context.Context, uid uint) (*userdomain.User, error) {
	return nil, nil
}

func (u *userRepoStub) GetUserByUsername(ctx context.Context, username string) (*userdomain.User, error) {
	return nil, nil
}

func (u *userRepoStub) GetUserSessionLiveTime(ctx context.Context, uid uint) (*userdomain.SessionTime, error) {
	if u.sessionLive == 0 {
		return nil, nil
	}
	return &userdomain.SessionTime{Duration: u.sessionLive}, nil
}

func (u *userRepoStub) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	return nil
}

func (u *userRepoStub) IsExists(ctx context.Context, user userdomain.User) (bool, error) {
	return false, nil
}

type permsRepoStub struct {
	forRank *permissions.Permissions
	forUser *permissions.Permissions

	has    bool
	hasAll bool

	// ошибки по методам
	getForRankErr    error
	getForUserErr    error
	hasErr           error
	hasAllErr        error
	changeForUserErr error
	changeForRankErr error
	setForUserErr    error
	setForRankErr    error
}

func (r *permsRepoStub) GetForRank(ctx context.Context, rank string) (*permissions.Permissions, error) {
	if r.getForRankErr != nil {
		return nil, r.getForRankErr
	}
	return r.forRank, nil
}

func (r *permsRepoStub) GetForUser(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	if r.getForUserErr != nil {
		return nil, r.getForUserErr
	}
	return r.forUser, nil
}

func (r *permsRepoStub) Has(ctx context.Context, uid uint, need permissions.Permission) (bool, error) {
	if r.hasErr != nil {
		return false, r.hasErr
	}
	return r.has, nil
}

func (r *permsRepoStub) HasAll(ctx context.Context, uid uint, need ...permissions.Permission) (bool, error) {
	if r.hasAllErr != nil {
		return false, r.hasAllErr
	}
	return r.hasAll, nil
}

func (r *permsRepoStub) ChangeForUser(ctx context.Context, uid uint, need permissions.Permission, state bool) error {
	return r.changeForUserErr
}

func (r *permsRepoStub) ChangeForRank(ctx context.Context, rank string, need permissions.Permission, state bool) error {
	return r.changeForRankErr
}

func (r *permsRepoStub) SetForUser(ctx context.Context, uid uint, perms *permissions.Permissions) error {
	return r.setForUserErr
}

func (r *permsRepoStub) SetForRank(ctx context.Context, rank string, perms *permissions.Permissions) error {
	return r.setForRankErr
}
