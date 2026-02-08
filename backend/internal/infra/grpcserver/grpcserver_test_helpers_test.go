package grpcserver_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userinfo "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	sessionsdomain "Aesterial/backend/internal/domain/sessions"
	"Aesterial/backend/internal/domain/user"
	userpb "Aesterial/backend/internal/gen/user/v1"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/shared/types"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"
)

func TestMain(m *testing.M) {
	_ = os.Setenv("COOKIES_SECRET", "test-secret")
	_ = os.Setenv("COOKIES_NAME", "Aesterial_session")
	_ = os.Setenv("STORAGE_BUCKET", "test-bucket")
	_ = os.Setenv("STORAGE_REGION", "eu-central-1")
	_ = os.Setenv("STORAGE_ENDPOINT", "http://localhost:9000")
	_ = os.Setenv("STORAGE_ACCESS_KEY", "test-access")
	_ = os.Setenv("STORAGE_SECRET_KEY", "test-secret")
	_ = os.Setenv("STORAGE_USE_SSL", "false")
	os.Exit(m.Run())
}

func assertAppError(t *testing.T, err error, expected apperrors.ErrorST) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error %v, got nil", expected)
	}
	var appErr apperrors.ErrorST
	if !errors.As(err, &appErr) {
		t.Fatalf("expected app error %v, got %T", expected, err)
	}
	gotStatus := appErr.GRPCStatus()
	expectedStatus := expected.GRPCStatus()
	if gotStatus.Code() != expectedStatus.Code() || gotStatus.Message() != expectedStatus.Message() {
		t.Fatalf("expected error %v, got %v", expected, appErr)
	}
}

func newAuthContext(t *testing.T, sessionID uuid.UUID) context.Context {
	t.Helper()
	token := newSessionToken(t, sessionID)
	md := metadata.Pairs("authorization", "Bearer "+token)
	return metadata.NewIncomingContext(context.Background(), md)
}

func newSessionToken(t *testing.T, sessionID uuid.UUID) string {
	t.Helper()
	secret := os.Getenv("COOKIES_SECRET")
	if secret == "" {
		secret = "test-secret"
	}
	claims := &types.CookieClaims{
		ID: sessionID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "Aesterial",
			Subject:   "session",
			Audience:  jwt.ClaimStrings{"Aesterial-web"},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS384, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign token: %v", err)
	}
	return signed
}

func newAuthDeps(t *testing.T, uid uint) (context.Context, *sessionsapp.Service, *userinfo.Service, *authSessionsRepoStub, *authUserRepoStub) {
	t.Helper()
	sessionID := uuid.New()
	ctx := newAuthContext(t, sessionID)

	sessionsRepo := &authSessionsRepoStub{sessionID: sessionID, uid: uid}
	userRepo := &authUserRepoStub{
		getUserByUIDFn: func(_ context.Context, id uint) (*user.User, error) {
			return testUser(id), nil
		},
		isBannedFn: func(context.Context, uint) (bool, *user.BanInfo, error) {
			return false, nil, nil
		},
		hasAllPermsFn: func(context.Context, uint, ...permissions.Permission) (bool, error) {
			return true, nil
		},
		hasPermFn: func(context.Context, uint, permissions.Permission) (bool, error) {
			return true, nil
		},
	}

	sessionsSvc := sessionsapp.New(sessionsRepo)
	userSvc := userinfo.New(userRepo, sessionsRepo)
	return ctx, sessionsSvc, userSvc, sessionsRepo, userRepo
}

func testUser(uid uint) *user.User {
	return &user.User{
		UID:      uid,
		Username: "tester",
		Rank:     &rank.UserRank{Rank: rank.Rank{Name: "member"}},
		Joined:   time.Now(),
	}
}

type authSessionsRepoStub struct {
	sessionID uuid.UUID
	uid       uint

	isValidFn     func(ctx context.Context, sessionID uuid.UUID) (bool, error)
	getSessionFn  func(ctx context.Context, sessionID uuid.UUID) (*sessionsdomain.Session, error)
	getSessionsFn func(ctx context.Context, uid uint) (*sessionsdomain.Sessions, error)
	getUIDFn      func(ctx context.Context, sessionID uuid.UUID) (*uint, error)
	setRevokedFn  func(ctx context.Context, sessionID uuid.UUID) error
	setMFADoneFn  func(ctx context.Context, sessionID uuid.UUID) error
	resetMFAsFn   func(ctx context.Context, uid uint) error
	addSessionFn  func(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error
	updateLastFn  func(ctx context.Context, sessionID uuid.UUID) error
}

func (s *authSessionsRepoStub) IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	if s.isValidFn != nil {
		return s.isValidFn(ctx, sessionID)
	}
	if s.sessionID != uuid.Nil {
		return s.sessionID == sessionID, nil
	}
	return true, nil
}

func (s *authSessionsRepoStub) GetSession(ctx context.Context, sessionID uuid.UUID) (*sessionsdomain.Session, error) {
	if s.getSessionFn != nil {
		return s.getSessionFn(ctx, sessionID)
	}
	return nil, nil
}

func (s *authSessionsRepoStub) GetSessions(ctx context.Context, uid uint) (*sessionsdomain.Sessions, error) {
	if s.getSessionsFn != nil {
		return s.getSessionsFn(ctx, uid)
	}
	return nil, nil
}

func (s *authSessionsRepoStub) GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error) {
	if s.getUIDFn != nil {
		return s.getUIDFn(ctx, sessionID)
	}
	if s.uid != 0 {
		uid := s.uid
		return &uid, nil
	}
	return nil, nil
}

func (s *authSessionsRepoStub) SetRevoked(ctx context.Context, sessionID uuid.UUID) error {
	if s.setRevokedFn != nil {
		return s.setRevokedFn(ctx, sessionID)
	}
	return nil
}

func (s *authSessionsRepoStub) SetMFACompleted(ctx context.Context, sessionID uuid.UUID) error {
	if s.setMFADoneFn != nil {
		return s.setMFADoneFn(ctx, sessionID)
	}
	return nil
}

func (s *authSessionsRepoStub) ResetMFAs(ctx context.Context, uid uint) error {
	if s.resetMFAsFn != nil {
		return s.resetMFAsFn(ctx, uid)
	}
	return nil
}

func (s *authSessionsRepoStub) AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error {
	if s.addSessionFn != nil {
		return s.addSessionFn(ctx, sessionID, agentHash, expires, uid)
	}
	return nil
}

func (s *authSessionsRepoStub) UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error {
	if s.updateLastFn != nil {
		return s.updateLastFn(ctx, sessionID)
	}
	return nil
}

type authUserRepoStub struct {
	getListFn               func(ctx context.Context) ([]*userpb.UserPublic, error)
	getUIDFn                func(ctx context.Context, username string) (uint, error)
	getUsernameFn           func(ctx context.Context, uid uint) (string, error)
	getEmailFn              func(ctx context.Context, uid uint) (*user.Email, error)
	getRankFn               func(ctx context.Context, uid uint) (*rank.UserRank, error)
	getJoinedAtFn           func(ctx context.Context, uid uint) (*time.Time, error)
	getSettingsFn           func(ctx context.Context, uid uint) (*user.Settings, error)
	getUserByUIDFn          func(ctx context.Context, uid uint) (*user.User, error)
	getUserByUsernameFn     func(ctx context.Context, username string) (*user.User, error)
	getUserSessionLiveFn    func(ctx context.Context, uid uint) (*user.SessionTime, error)
	getUserLastActiveFn     func(ctx context.Context, uid uint) (*time.Time, error)
	getAvatarFn             func(ctx context.Context, uid uint) (*user.Avatar, error)
	updateDisplayNameFn     func(ctx context.Context, uid uint, displayName string) error
	setEmailVerifiedFn      func(ctx context.Context, email string, verified bool) error
	updatePasswordByEmailFn func(ctx context.Context, email string, passwordHash string) error
	isExistsFn              func(ctx context.Context, user user.User) (bool, error)
	isBannedFn              func(ctx context.Context, uid uint) (bool, *user.BanInfo, error)
	banFn                   func(ctx context.Context, info user.BanInfo) error
	unbanFn                 func(ctx context.Context, uid uint) error
	banInfoFn               func(ctx context.Context, uid uint) (*user.BanInfo, error)
	addAvatarFn             func(ctx context.Context, uid uint, avatar user.Avatar) error
	deleteAvatarFn          func(ctx context.Context, uid uint) error
	deleteProfileFn         func(ctx context.Context, uid uint) error
	hasPermFn               func(ctx context.Context, uid uint, perm permissions.Permission) (bool, error)
	hasAllPermsFn           func(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error)
	permsFn                 func(ctx context.Context, uid uint) (*permissions.Permissions, error)
	changePermsFn           func(ctx context.Context, uid uint, perm permissions.Permission, state bool) error
	setRankFn               func(ctx context.Context, uid uint, rank string, expires *time.Time) error
	setCodeUsedFn           func(ctx context.Context, hash string) error
	getRecoveryCodesFn      func(ctx context.Context, uid uint) ([]string, error)
	cascadeRecoveryCodesFn  func(ctx context.Context, uid uint, codes []string) error
	appendRecoveryCodesFn   func(ctx context.Context, uid uint, codes []string) error
	setConfirmedFn          func(ctx context.Context, uid uint) error
	setPendingTOTPFn        func(ctx context.Context, uid uint, pending string) error
	getPendingTOTPFn        func(ctx context.Context, uid uint) (*string, error)
	isTOTPEnabledFn         func(ctx context.Context, uid uint) (bool, error)
	resetTOTPFn             func(ctx context.Context, uid uint) error
	isValidRecoveryFn       func(ctx context.Context, uid uint, code string) (bool, error)
	isTOTPendingFn          func(ctx context.Context, uid uint) (bool, error)
	getTOTPLastStepFn       func(ctx context.Context, uid uint) (*int64, error)
	getTOTPSecretFn         func(ctx context.Context, uid uint) (string, error)
	setTOTPLastStepFn       func(ctx context.Context, uid uint, step int64) error
	canEditFn               func(ctx context.Context, user uint, target uint) (bool, error)
	activateRank            func(ctx context.Context, uid uint, code uuid.UUID) (string, error)
}

func (u *authUserRepoStub) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
	if u.getListFn != nil {
		return u.getListFn(ctx)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetUID(ctx context.Context, username string) (uint, error) {
	if u.getUIDFn != nil {
		return u.getUIDFn(ctx, username)
	}
	return 0, nil
}

func (u *authUserRepoStub) GetUsername(ctx context.Context, uid uint) (string, error) {
	if u.getUsernameFn != nil {
		return u.getUsernameFn(ctx, uid)
	}
	return "", nil
}

func (u *authUserRepoStub) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	if u.getEmailFn != nil {
		return u.getEmailFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetRank(ctx context.Context, uid uint) (*rank.UserRank, error) {
	if u.getRankFn != nil {
		return u.getRankFn(ctx, uid)
	}
	return &rank.UserRank{Rank: rank.Rank{Name: "member"}}, nil
}

func (u *authUserRepoStub) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	if u.getJoinedAtFn != nil {
		return u.getJoinedAtFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
	if u.getSettingsFn != nil {
		return u.getSettingsFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	if u.getUserByUIDFn != nil {
		return u.getUserByUIDFn(ctx, uid)
	}
	return testUser(uid), nil
}

func (u *authUserRepoStub) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	if u.getUserByUsernameFn != nil {
		return u.getUserByUsernameFn(ctx, username)
	}
	return testUser(1), nil
}

func (u *authUserRepoStub) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if u.getUserSessionLiveFn != nil {
		return u.getUserSessionLiveFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetUserLastActive(ctx context.Context, uid uint) (*time.Time, error) {
	if u.getUserLastActiveFn != nil {
		return u.getUserLastActiveFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetAvatar(ctx context.Context, uid uint) (*user.Avatar, error) {
	if u.getAvatarFn != nil {
		return u.getAvatarFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	if u.updateDisplayNameFn != nil {
		return u.updateDisplayNameFn(ctx, uid, displayName)
	}
	return nil
}

func (u *authUserRepoStub) SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error {
	if u.setEmailVerifiedFn != nil {
		return u.setEmailVerifiedFn(ctx, email, verified)
	}
	return nil
}

func (u *authUserRepoStub) UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error {
	if u.updatePasswordByEmailFn != nil {
		return u.updatePasswordByEmailFn(ctx, email, passwordHash)
	}
	return nil
}

func (u *authUserRepoStub) IsExists(ctx context.Context, user user.User) (bool, error) {
	if u.isExistsFn != nil {
		return u.isExistsFn(ctx, user)
	}
	return false, nil
}

func (u *authUserRepoStub) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if u.isBannedFn != nil {
		return u.isBannedFn(ctx, uid)
	}
	return false, nil, nil
}

func (u *authUserRepoStub) Ban(ctx context.Context, info user.BanInfo) error {
	if u.banFn != nil {
		return u.banFn(ctx, info)
	}
	return nil
}

func (u *authUserRepoStub) UnBan(ctx context.Context, uid uint) error {
	if u.unbanFn != nil {
		return u.unbanFn(ctx, uid)
	}
	return nil
}

func (u *authUserRepoStub) BanInfo(ctx context.Context, uid uint) (*user.BanInfo, error) {
	if u.banInfoFn != nil {
		return u.banInfoFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) AddAvatar(ctx context.Context, uid uint, avatar user.Avatar) error {
	if u.addAvatarFn != nil {
		return u.addAvatarFn(ctx, uid, avatar)
	}
	return nil
}

func (u *authUserRepoStub) DeleteAvatar(ctx context.Context, uid uint) error {
	if u.deleteAvatarFn != nil {
		return u.deleteAvatarFn(ctx, uid)
	}
	return nil
}

func (u *authUserRepoStub) DeleteProfile(ctx context.Context, uid uint) error {
	if u.deleteProfileFn != nil {
		return u.deleteProfileFn(ctx, uid)
	}
	return nil
}

func (u *authUserRepoStub) HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error) {
	if u.hasPermFn != nil {
		return u.hasPermFn(ctx, uid, perm)
	}
	return true, nil
}

func (u *authUserRepoStub) HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error) {
	if u.hasAllPermsFn != nil {
		return u.hasAllPermsFn(ctx, uid, perms...)
	}
	return true, nil
}

func (u *authUserRepoStub) Perms(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	if u.permsFn != nil {
		return u.permsFn(ctx, uid)
	}
	return &permissions.Permissions{}, nil
}

func (u *authUserRepoStub) ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error {
	if u.changePermsFn != nil {
		return u.changePermsFn(ctx, uid, perm, state)
	}
	return nil
}

func (u *authUserRepoStub) SetRank(ctx context.Context, uid uint, rank string, expires *time.Time) error {
	if u.setRankFn != nil {
		return u.setRankFn(ctx, uid, rank, expires)
	}
	return nil
}

func (u *authUserRepoStub) SetCodeUsed(ctx context.Context, hash string) error {
	if u.setCodeUsedFn != nil {
		return u.setCodeUsedFn(ctx, hash)
	}
	return nil
}

func (u *authUserRepoStub) GetRecoveryCodes(ctx context.Context, uid uint) ([]string, error) {
	if u.getRecoveryCodesFn != nil {
		return u.getRecoveryCodesFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) CascadeRecoveryCodes(ctx context.Context, uid uint, codes []string) error {
	if u.cascadeRecoveryCodesFn != nil {
		return u.cascadeRecoveryCodesFn(ctx, uid, codes)
	}
	return nil
}

func (u *authUserRepoStub) AppendRecoveryCodes(ctx context.Context, uid uint, codes []string) error {
	if u.appendRecoveryCodesFn != nil {
		return u.appendRecoveryCodesFn(ctx, uid, codes)
	}
	return nil
}

func (u *authUserRepoStub) SetConfirmed(ctx context.Context, uid uint) error {
	if u.setConfirmedFn != nil {
		return u.setConfirmedFn(ctx, uid)
	}
	return nil
}

func (u *authUserRepoStub) SetPendingTOTP(ctx context.Context, uid uint, pending string) error {
	if u.setPendingTOTPFn != nil {
		return u.setPendingTOTPFn(ctx, uid, pending)
	}
	return nil
}

func (u *authUserRepoStub) GetPendingTOTP(ctx context.Context, uid uint) (*string, error) {
	if u.getPendingTOTPFn != nil {
		return u.getPendingTOTPFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) IsTOTPEnabled(ctx context.Context, uid uint) (bool, error) {
	if u.isTOTPEnabledFn != nil {
		return u.isTOTPEnabledFn(ctx, uid)
	}
	return false, nil
}

func (u *authUserRepoStub) ResetTOTP(ctx context.Context, uid uint) error {
	if u.resetTOTPFn != nil {
		return u.resetTOTPFn(ctx, uid)
	}
	return nil
}

func (u *authUserRepoStub) IsValidRecovery(ctx context.Context, uid uint, code string) (bool, error) {
	if u.isValidRecoveryFn != nil {
		return u.isValidRecoveryFn(ctx, uid, code)
	}
	return false, nil
}

func (u *authUserRepoStub) IsTOTPending(ctx context.Context, uid uint) (bool, error) {
	if u.isTOTPendingFn != nil {
		return u.isTOTPendingFn(ctx, uid)
	}
	return false, nil
}

func (u *authUserRepoStub) GetTOTPLastStep(ctx context.Context, uid uint) (*int64, error) {
	if u.getTOTPLastStepFn != nil {
		return u.getTOTPLastStepFn(ctx, uid)
	}
	return nil, nil
}

func (u *authUserRepoStub) GetTOTPSecret(ctx context.Context, uid uint) (string, error) {
	if u.getTOTPSecretFn != nil {
		return u.getTOTPSecretFn(ctx, uid)
	}
	return "", nil
}

func (u *authUserRepoStub) SetTOTPLastStep(ctx context.Context, uid uint, step int64) error {
	if u.setTOTPLastStepFn != nil {
		return u.setTOTPLastStepFn(ctx, uid, step)
	}
	return nil
}

func (u *authUserRepoStub) CanEdit(ctx context.Context, user uint, target uint) (bool, error) {
	if u.canEditFn != nil {
		return u.canEditFn(ctx, user, target)
	}
	return true, nil
}

func (u *authUserRepoStub) ActivateRank(ctx context.Context, uid uint, code uuid.UUID) (string, error) {
	if u.activateRank != nil {
		return u.activateRank(ctx, uid, code)
	}
	return "", nil
}
