package grpcserver

import (
	"ascendant/backend/internal/app/config"
	permissionsapp "ascendant/backend/internal/app/info/permissions"
	sessionsapp "ascendant/backend/internal/app/info/sessions"
	userapp "ascendant/backend/internal/app/info/user"
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/domain/user"
	"ascendant/backend/internal/shared/types"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

type Authenticator struct {
	Sessions    *sessionsapp.Service
	Permissions *permissionsapp.Service
	User        *userapp.Service
}

func NewAuthenticator(sessions *sessionsapp.Service, perms *permissionsapp.Service, us *userapp.Service) *Authenticator {
	return &Authenticator{
		Sessions:    sessions,
		Permissions: perms,
		User:        us,
	}
}

func (a *Authenticator) RequireUser(ctx context.Context) (*user.RequestData, error) {
	if a == nil || a.Sessions == nil {
		return nil, status.Error(codes.Internal, "auth not configured")
	}

	token, err := tokenFromContext(ctx)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "missing session token")
	}

	claims, err := parseClaims(token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid session token")
	}

	sessionID, err := uuid.Parse(claims.ID)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid session token")
	}

	valid, err := a.Sessions.IsValid(ctx, sessionID)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "invalid session")
	}
	if !valid {
		return nil, status.Error(codes.Unauthenticated, "expired session")
	}

	uid, err := a.Sessions.GetUID(ctx, sessionID)
	if err != nil || uid == nil {
		return nil, status.Error(codes.Unauthenticated, "invalid session")
	}
	banned, _, err := a.User.IsBanned(ctx, *uid)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, "failed to check ban state")
	}
	if banned {
		return nil, status.Error(codes.Unauthenticated, "user is banned")
	}

	return &user.RequestData{UID: *uid, SessionID: sessionID}, nil
}

func (a *Authenticator) RequirePermissions(ctx context.Context, uid uint, need ...permissions.Permission) error {
	if a == nil || a.Permissions == nil {
		return status.Error(codes.Internal, "permissions not configured")
	}
	if len(need) == 0 {
		return nil
	}
	ok, err := a.Permissions.HasAll(ctx, uid, need...)
	if err != nil {
		return status.Error(codes.PermissionDenied, "forbidden")
	}
	if !ok {
		return status.Error(codes.PermissionDenied, "forbidden")
	}
	return nil
}

func (a *Authenticator) RequireViewPermissions(ctx context.Context, uid uint) error {
	if a == nil || a.Permissions == nil {
		return status.Error(codes.Internal, "permissions not configured")
	}
	ok, err := a.Permissions.Has(ctx, uid, permissions.ViewPermissions)
	if err == nil && ok {
		return nil
	}
	ok, err = a.Permissions.Has(ctx, uid, permissions.ManagePermissions)
	if err == nil && ok {
		return nil
	}
	return status.Error(codes.PermissionDenied, "forbidden")
}

func issueSessionToken(sessionID string, ttl time.Duration) (string, error) {
	if sessionID == "" {
		return "", errors.New("session id is empty")
	}
	secret := config.Get().Cookies.Secret
	if secret == "" {
		return "", errors.New("cookie secret is empty")
	}
	now := time.Now()
	claims := &types.CookieClaims{
		ID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "ascendant",
			Subject:   "session",
			Audience:  jwt.ClaimStrings{"ascendant-web"},
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS384, claims)
	return token.SignedString([]byte(secret))
}

func setSessionCookieHeader(ctx context.Context, token string, ttl time.Duration) error {
	name := config.Get().Cookies.Name
	if name == "" {
		name = "ascendant_session"
	}
	secure := config.Get().Cookies.Secure
	if token == "" {
		return errors.New("token is empty")
	}
	cookie := &http.Cookie{
		Name:     name,
		Value:    url.QueryEscape(token),
		Path:     "/",
		Domain:   config.Get().Cookies.Domain,
		MaxAge:   int(ttl.Seconds()),
		Secure:   secure,
		HttpOnly: true,
		SameSite: parseSameSite(config.Get().Cookies.SameSite),
	}
	return grpc.SetHeader(ctx, metadata.Pairs("set-cookie", cookie.String()))
}

func parseClaims(tokenString string) (*types.CookieClaims, error) {
	secret := config.Get().Cookies.Secret
	if secret == "" {
		return nil, errors.New("cookie secret is empty")
	}
	claims := &types.CookieClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS384 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token is invalid")
	}
	return claims, nil
}

func tokenFromContext(ctx context.Context) (string, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", errors.New("missing metadata")
	}

	if token := tokenFromAuthorization(md.Get("authorization")); token != "" {
		return token, nil
	}

	if token := tokenFromCookie(md.Get("cookie")); token != "" {
		return token, nil
	}

	if token := tokenFromHeader(md.Get("x-session-token")); token != "" {
		return token, nil
	}

	return "", errors.New("missing token")
}

func tokenFromAuthorization(values []string) string {
	for _, v := range values {
		raw := strings.TrimSpace(v)
		if raw == "" {
			continue
		}
		lower := strings.ToLower(raw)
		if strings.HasPrefix(lower, "bearer ") {
			return strings.TrimSpace(raw[len("bearer "):])
		}
		return raw
	}
	return ""
}

func tokenFromCookie(values []string) string {
	name := config.Get().Cookies.Name
	if name == "" {
		name = "ascendant_session"
	}
	for _, v := range values {
		for part := range strings.SplitSeq(v, ";") {
			kv := strings.SplitN(strings.TrimSpace(part), "=", 2)
			if len(kv) != 2 {
				continue
			}
			if kv[0] != name {
				continue
			}
			token, err := url.QueryUnescape(kv[1])
			if err != nil {
				return kv[1]
			}
			return token
		}
	}
	return ""
}

func tokenFromHeader(values []string) string {
	for _, v := range values {
		raw := strings.TrimSpace(v)
		if raw == "" {
			continue
		}
		return raw
	}
	return ""
}

func parseSameSite(v string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	case "lax", "":
		return http.SameSiteLaxMode
	default:
		return http.SameSiteLaxMode
	}
}

func userAgentHash(ctx context.Context) string {
	agent := ""
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if values := md.Get("user-agent"); len(values) > 0 {
			agent = values[0]
		}
	}
	if agent == "" {
		if p, ok := peer.FromContext(ctx); ok && p.Addr != nil {
			agent = p.Addr.String()
		}
	}
	if agent == "" {
		agent = "unknown"
	}
	sum := sha256.Sum256([]byte(agent))
	return hex.EncodeToString(sum[:])
}
