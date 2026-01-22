package grpcserver_test

import (
	loginapp "Aesterial/backend/internal/app/auth"
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userinfo "Aesterial/backend/internal/app/info/user"
	verificationapp "Aesterial/backend/internal/app/verification"
	logindomain "Aesterial/backend/internal/domain/login"
	"Aesterial/backend/internal/domain/permissions"
	rankdomain "Aesterial/backend/internal/domain/rank"
	sessionsdomain "Aesterial/backend/internal/domain/sessions"
	userdomain "Aesterial/backend/internal/domain/user"
	verdomain "Aesterial/backend/internal/domain/verification"
	loginpb "Aesterial/backend/internal/gen/login/v1"
	userpb "Aesterial/backend/internal/gen/user/v1"
	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

func TestRegister(t *testing.T) {
	t.Setenv("COOKIES_SECRET", "test-secret")
	t.Setenv("COOKIES_NAME", "Aesterial_session")

	loginRepo := &loginRepoStub{registerUID: 42}
	sessionsRepo := &sessionsRepoStub{}
	userRepo := &userRepoStub{}

	service := newLoginService(loginRepo, sessionsRepo, userRepo)
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
	t.Setenv("COOKIES_NAME", "Aesterial_session")

	loginRepo := &loginRepoStub{authUID: 7}
	sessionsRepo := &sessionsRepoStub{}
	userRepo := &userRepoStub{}

	service := newLoginService(loginRepo, sessionsRepo, userRepo)
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

func newLoginService(repo logindomain.Repository, sessionsRepo sessionsdomain.Repository, userRepo userdomain.Repository) *grpcserver.LoginService {
	sessionsService := sessionsapp.New(sessionsRepo)
	userService := userinfo.New(userRepo, sessionsRepo)
	verificationService := verificationapp.New(&verificationRepoStub{}, nil)
	loginService := loginapp.New(repo, sessionsService, userService)
	return grpcserver.NewLoginService(loginService, sessionsService, userService, verificationService)
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

// AddAvatar implements user.Repository.
func (u *userRepoStub) AddAvatar(ctx context.Context, uid uint, avatar userdomain.Avatar) error {
	return nil
}

// DeleteAvatar implements user.Repository.
func (u *userRepoStub) DeleteAvatar(ctx context.Context, uid uint) error {
	return nil
}

// GetAvatar implements user.Repository.
func (u *userRepoStub) GetAvatar(ctx context.Context, uid uint) (*userdomain.Avatar, error) {
	return nil, nil
}

func (u *userRepoStub) BanInfo(ctx context.Context, uid uint) (*userdomain.BanInfo, error) {
	return nil, nil
}

func (u *userRepoStub) Ban(ctx context.Context, info userdomain.BanInfo) error {
	return nil
}

func (u *userRepoStub) IsBanned(ctx context.Context, uid uint) (bool, *userdomain.BanInfo, error) {
	return false, nil, nil
}

func (u *userRepoStub) UnBan(ctx context.Context, uid uint) error {
	return nil
}

func (u *userRepoStub) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
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

func (u *userRepoStub) GetRank(ctx context.Context, uid uint) (*rankdomain.UserRank, error) {
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

func (u *userRepoStub) SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error {
	return nil
}

func (u *userRepoStub) UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error {
	return nil
}

func (u *userRepoStub) IsExists(ctx context.Context, user userdomain.User) (bool, error) {
	return false, nil
}

func (u *userRepoStub) HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error) {
	return false, nil
}

func (u *userRepoStub) HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error) {
	return false, nil
}

func (u *userRepoStub) Perms(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	return nil, nil
}

func (u *userRepoStub) ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error {
	return nil
}

type verificationRepoStub struct{}

func (v *verificationRepoStub) Create(ctx context.Context, email string, purpose verdomain.Purpose, ip string, userAgent string, ttl time.Duration) (token string, err error) {
	return "", nil
}

func (v *verificationRepoStub) Consume(ctx context.Context, purpose verdomain.Purpose, token string) (*verdomain.TokenRecord, error) {
	return nil, nil
}

func (v *verificationRepoStub) BanEmail(ctx context.Context, email string, reason string) error {
	return nil
}

func (v *verificationRepoStub) IsBanned(ctx context.Context, email string) (bool, error) {
	return false, nil
}

func (v *verificationRepoStub) GetRecord(ctx context.Context, purpose verdomain.Purpose, token string) (*verdomain.TokenRecord, error) {
	return nil, nil
}
