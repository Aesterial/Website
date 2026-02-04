package grpcserver

import (
	"Aesterial/backend/internal/app/config"
	sessionsapp "Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/user"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"Aesterial/backend/internal/shared/types"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
)

type Authenticator struct {
	Sessions *sessionsapp.Service
	User     *userapp.Service
}

func NewAuthenticator(sessions *sessionsapp.Service, us *userapp.Service) *Authenticator {
	return &Authenticator{
		Sessions: sessions,
		User:     us,
	}
}

func (a *Authenticator) RequireUser(ctx context.Context, nocheck ...bool) (*user.RequestData, error) {
	if a == nil || a.Sessions == nil {
		return nil, apperrors.NotConfigured
	}

	token, err := tokenFromContext(ctx)
	if err != nil {
		return nil, apperrors.InvalidArguments
	}

	claims, err := parseClaims(token)
	if err != nil {
		return nil, apperrors.InvalidArguments
	}

	sessionID, err := uuid.Parse(claims.ID)
	if err != nil {
		return nil, apperrors.InvalidArguments
	}

	valid, err := a.Sessions.IsValid(ctx, sessionID)
	if err != nil {
		if errors.Is(err, apperrors.NeedVerify) {
			if len(nocheck) > 0 && nocheck[0] == true {
				valid = true
			} else {
				return nil, apperrors.NeedVerify
			}
		} else {
			logger.Debug("failed to check is session valid: "+err.Error(), "auth.sessions.valid")
			return nil, apperrors.Wrap(err)
		}
	}
	if !valid {
		return nil, apperrors.Unauthenticated
	}

	uid, err := a.Sessions.GetUID(ctx, sessionID)
	if err != nil || uid == nil {
		return nil, apperrors.InvalidArguments
	}
	banned, _, err := a.User.IsBanned(ctx, *uid)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		logger.Debug("error: "+err.Error(), "")
		return nil, apperrors.InvalidArguments
	}
	us := &user.RequestData{UID: *uid, SessionID: sessionID}
	if banned {
		return us, apperrors.Banned
	}
	return us, nil
}

func (a *Authenticator) RequirePermissions(ctx context.Context, uid uint, need ...permissions.Permission) error {
	if a == nil || a.User == nil {
		return apperrors.NotConfigured
	}
	if len(need) == 0 {
		return nil
	}
	ok, err := a.User.HasAllPerms(ctx, uid, need...)
	if err != nil {
		return apperrors.Wrap(err)
	}
	if !ok {
		return apperrors.AccessDenied
	}
	return nil
}

func (a *Authenticator) RequireViewPermissions(ctx context.Context, uid uint) error {
	if a == nil || a.User == nil {
		return apperrors.NotConfigured
	}
	ok, err := a.User.HasPerm(ctx, uid, permissions.RanksPermissionsChange)
	if err != nil {
		return apperrors.ServerError.AddErrDetails("Error: " + err.Error())
	}
	if !ok {
		return apperrors.AccessDenied
	}
	return nil
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
			Issuer:    "Aesterial",
			Subject:   "session",
			Audience:  jwt.ClaimStrings{"Aesterial-web"},
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
		name = "Aesterial_session"
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
		name = "Aesterial_session"
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

func clientIP(ctx context.Context) string {
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		if xff := md.Get("x-forwarded-for"); len(xff) > 0 && xff[0] != "" {
			parts := strings.Split(xff[0], ",")
			ip := strings.TrimSpace(parts[0])
			if ip != "" {
				return ip
			}
		}
		if xrip := md.Get("x-real-ip"); len(xrip) > 0 && xrip[0] != "" {
			return strings.TrimSpace(xrip[0])
		}
	}

	if p, ok := peer.FromContext(ctx); ok && p.Addr != nil {
		host, _, err := net.SplitHostPort(p.Addr.String())
		if err == nil && host != "" {
			return host
		}
		return p.Addr.String()
	}

	return "unknown"
}
