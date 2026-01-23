package grpcserver

import (
	"Aesterial/backend/internal/app/config"
	logindomain "Aesterial/backend/internal/domain/login"
	userdomain "Aesterial/backend/internal/domain/user"
	loginpb "Aesterial/backend/internal/gen/login/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/emptypb"
)

const (
	vkAuthEndpoint  = "https://oauth.vk.com/authorize"
	vkTokenEndpoint = "https://oauth.vk.com/access_token"
	vkUsersEndpoint = "https://api.vk.com/method/users.get"
	vkDefaultScope  = "email"
	vkDefaultAPI    = "5.131"
)

type vkConfig struct {
	clientID           string
	clientSecret       string
	redirectURI        string
	scope              string
	apiVersion         string
	successRedirectURL string
	stateTTL           time.Duration
	stateSecret        string
}

type vkTokenResponse struct {
	AccessToken     string `json:"access_token"`
	Email           string `json:"email"`
	UserID          int64  `json:"user_id"`
	Error           string `json:"error"`
	ErrorCode       int    `json:"error_code"`
	ErrorDesc       string `json:"error_description"`
	ErrorReason     string `json:"error_reason"`
	ErrorMessage    string `json:"error_msg"`
	ErrorDescAlt    string `json:"error_description_alt"`
	ErrorReasonAlt  string `json:"error_reason_alt"`
	ErrorMessageAlt string `json:"error_msg_alt"`
}

type vkAPIError struct {
	ErrorCode int    `json:"error_code"`
	ErrorMsg  string `json:"error_msg"`
}

type vkUser struct {
	ID            int64  `json:"id"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	Domain        string `json:"domain"`
	Photo200      string `json:"photo_200"`
	Photo200Orig  string `json:"photo_200_orig"`
	PhotoMax      string `json:"photo_max"`
	PhotoMaxOrig  string `json:"photo_max_orig"`
	Photo400Orig  string `json:"photo_400_orig"`
	PhotoBase     string `json:"photo_100"`
	PhotoBaseOrig string `json:"photo_100_orig"`
}

type vkUsersResponse struct {
	Response []vkUser    `json:"response"`
	Error    *vkAPIError `json:"error"`
}

func (s *LoginService) VkStart(ctx context.Context, _ *emptypb.Empty) (*loginpb.VKStartResponse, error) {
	cfg, err := loadVKConfig(false)
	if err != nil {
		return nil, err
	}
	state, err := generateVKState(cfg.stateSecret)
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to generate state")
	}
	authURL := buildVKAuthURL(cfg, state)
	return &loginpb.VKStartResponse{AuthUrl: authURL, State: state}, nil
}

func (s *LoginService) VkCallback(ctx context.Context, req *loginpb.VKCallbackRequest) (*loginpb.VKCallbackResponse, error) {
	if s == nil || s.login == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("login service not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request is empty")
	}
	cfg, err := loadVKConfig(true)
	if err != nil {
		return nil, err
	}
	code := strings.TrimSpace(req.GetCode())
	state := strings.TrimSpace(req.GetState())
	if code == "" || state == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("code or state is empty")
	}
	if err := verifyVKState(cfg.stateSecret, cfg.stateTTL, state); err != nil {
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid vk state")
	}

	tokenResp, err := exchangeVKCode(ctx, cfg, code)
	if err != nil {
		return nil, err
	}
	email := strings.TrimSpace(tokenResp.Email)
	if email == "" {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("vk email is empty")
	}
	userID := tokenResp.UserID
	if userID == 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("vk user id is empty")
	}

	if s.verification != nil {
		banned, err := s.verification.IsBanned(ctx, email)
		if err != nil {
			return nil, apperrors.Wrap(err)
		}
		if banned {
			return nil, apperrors.AccessDenied.AddErrDetails("email is banned")
		}
	}

	profile, err := fetchVKProfile(ctx, cfg, tokenResp.AccessToken, userID)
	if err != nil {
		return nil, err
	}

	linkedID := strconv.FormatInt(userID, 10)
	uid, err := s.login.GetOAuthUID(ctx, logindomain.OAuthServiceVK, linkedID)
	if err != nil && !isRecordNotFound(err) {
		return nil, apperrors.Wrap(err)
	}

	var generatedPassword string
	isNewUser := false
	if uid == nil || isRecordNotFound(err) {
		uid, err = s.login.GetUIDByEmail(ctx, email)
		if err != nil && !isRecordNotFound(err) {
			return nil, apperrors.Wrap(err)
		}
		if uid != nil && err == nil {
			if err := s.login.LinkOAuth(ctx, logindomain.OAuthServiceVK, linkedID, *uid); err != nil {
				return nil, apperrors.Wrap(err)
			}
		} else {
			generatedPassword, err = generateRandomPassword(16)
			if err != nil {
				return nil, apperrors.ServerError.AddErrDetails("failed to generate password")
			}
			username := buildVKUsername(profile, linkedID)
			uid, err = s.registerVKUser(ctx, username, email, generatedPassword)
			if err != nil {
				return nil, err
			}
			isNewUser = true
			if err := s.login.LinkOAuth(ctx, logindomain.OAuthServiceVK, linkedID, *uid); err != nil {
				return nil, apperrors.Wrap(err)
			}

			displayName := strings.TrimSpace(strings.Join([]string{profile.FirstName, profile.LastName}, " "))
			if displayName != "" && s.login.User != nil {
				if err := s.login.User.UpdateDisplayName(ctx, *uid, displayName); err != nil {
					return nil, apperrors.Wrap(err)
				}
			}
			if s.login.User != nil {
				if err := s.login.User.SetEmailVerifiedByAddress(ctx, email, true); err != nil {
					logger.Debug("failed to set email verified: "+err.Error(), "login.vk.email_verified")
				}
			}
			if err := s.storeVKAvatar(ctx, *uid, profile); err != nil {
				logger.Debug("failed to store vk avatar: "+err.Error(), "login.vk.avatar")
			}
		}
	}

	if uid == nil {
		return nil, apperrors.ServerError.AddErrDetails("uid is empty")
	}

	if isNewUser && generatedPassword != "" {
		if s.verification == nil || s.verification.Mailer == nil {
			return nil, apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
		}
		if _, err := s.verification.Mailer.SendRegistrationPassword(ctx, email, generatedPassword); err != nil {
			logger.Debug("failed to send registration password: "+err.Error(), "login.vk.mailer")
		}
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to register session: " + err.Error())
	}

	traceID := TraceIDOrNew(ctx)
	logger.Info("Successfully authorized via VK", "login.vk.success", logger.EventActor{Type: logger.User, ID: *uid}, logger.Success, traceID)
	return &loginpb.VKCallbackResponse{RedirectUrl: cfg.successRedirectURL, Tracing: traceID}, nil
}

func (s *LoginService) registerVKUser(ctx context.Context, baseUsername string, email string, password string) (*uint, error) {
	username := strings.TrimSpace(baseUsername)
	if username == "" {
		username = "vkuser"
	}
	require := logindomain.RegisterRequire{
		Username: username,
		Email:    email,
		Password: password,
	}

	var lastErr error
	for i := 0; i < 3; i++ {
		uid, err := s.login.Register(ctx, require)
		if err == nil {
			return uid, nil
		}
		if errorContains(err, "duplicate key value violates unique") {
			require.Username = username + "_" + randomSuffix(4)
			lastErr = err
			continue
		}
		return nil, apperrors.Wrap(err)
	}
	if lastErr != nil {
		return nil, apperrors.Wrap(lastErr)
	}
	return nil, apperrors.ServerError.AddErrDetails("failed to register vk user")
}

func (s *LoginService) storeVKAvatar(ctx context.Context, uid uint, profile vkUser) error {
	if s == nil || s.storage == nil || s.login == nil || s.login.User == nil {
		return nil
	}
	photoURL := pickVKAvatar(profile)
	if photoURL == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, photoURL, nil)
	if err != nil {
		return err
	}
	resp, err := vkHTTPClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("vk avatar download status: %d", resp.StatusCode)
	}

	key, err := s.storage.UserAvatarKey(strconv.FormatUint(uint64(uid), 10), "current")
	if err != nil {
		return err
	}
	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	sizeBytes := resp.ContentLength
	if sizeBytes < 0 {
		sizeBytes = 0
	}
	if err := s.storage.PutObject(ctx, key, resp.Body, contentType, sizeBytes); err != nil {
		return err
	}

	avatar := userdomain.Avatar{
		ContentType: contentType,
		Key:         key,
		SizeBytes:   safeInt(sizeBytes),
		Updated:     time.Now(),
	}
	if err := s.login.User.AddAvatar(ctx, uid, avatar); err != nil {
		_ = s.storage.Delete(ctx, key)
		return err
	}
	return nil
}

func loadVKConfig(requireSecret bool) (vkConfig, error) {
	env := config.Get()
	clientID := strings.TrimSpace(env.VK.ClientID)
	redirectURI := strings.TrimSpace(env.VK.RedirectURI)
	if clientID == "" || redirectURI == "" {
		return vkConfig{}, apperrors.NotConfigured.AddErrDetails("vk config is missing")
	}
	clientSecret := strings.TrimSpace(env.VK.ClientSecret)
	if requireSecret && clientSecret == "" {
		return vkConfig{}, apperrors.NotConfigured.AddErrDetails("vk client secret is missing")
	}
	scope := strings.TrimSpace(env.VK.Scope)
	if scope == "" {
		scope = vkDefaultScope
	}
	apiVersion := strings.TrimSpace(env.VK.APIVersion)
	if apiVersion == "" {
		apiVersion = vkDefaultAPI
	}
	ttl := time.Duration(env.VK.StateTTLSeconds) * time.Second
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	stateSecret := strings.TrimSpace(env.VK.StateSecret)
	if stateSecret == "" {
		stateSecret = strings.TrimSpace(env.Cookies.Secret)
	}
	if stateSecret == "" {
		return vkConfig{}, apperrors.NotConfigured.AddErrDetails("vk state secret is missing")
	}
	successRedirect := strings.TrimSpace(env.VK.SuccessRedirectURL)
	if successRedirect == "" && strings.TrimSpace(env.Cookies.Domain) != "" {
		successRedirect = "https://" + strings.TrimSpace(env.Cookies.Domain)
	}
	if successRedirect == "" {
		return vkConfig{}, apperrors.NotConfigured.AddErrDetails("vk success redirect url is missing")
	}
	return vkConfig{
		clientID:           clientID,
		clientSecret:       clientSecret,
		redirectURI:        redirectURI,
		scope:              scope,
		apiVersion:         apiVersion,
		successRedirectURL: successRedirect,
		stateTTL:           ttl,
		stateSecret:        stateSecret,
	}, nil
}

func buildVKAuthURL(cfg vkConfig, state string) string {
	u, _ := url.Parse(vkAuthEndpoint)
	q := u.Query()
	q.Set("client_id", cfg.clientID)
	q.Set("display", "page")
	q.Set("redirect_uri", cfg.redirectURI)
	q.Set("scope", cfg.scope)
	q.Set("response_type", "code")
	q.Set("state", state)
	q.Set("v", cfg.apiVersion)
	u.RawQuery = q.Encode()
	return u.String()
}

func exchangeVKCode(ctx context.Context, cfg vkConfig, code string) (*vkTokenResponse, error) {
	u, _ := url.Parse(vkTokenEndpoint)
	q := u.Query()
	q.Set("client_id", cfg.clientID)
	q.Set("client_secret", cfg.clientSecret)
	q.Set("redirect_uri", cfg.redirectURI)
	q.Set("code", code)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	resp, err := vkHTTPClient().Do(req)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, apperrors.ServerError.AddErrDetails("vk token exchange failed")
	}
	var token vkTokenResponse
	if err := decodeJSON(resp.Body, &token); err != nil {
		return nil, apperrors.Wrap(err)
	}
	if token.AccessToken == "" {
		msg := token.Error
		if msg == "" {
			msg = token.ErrorMessage
		}
		if msg == "" {
			msg = token.ErrorDesc
		}
		if msg == "" {
			msg = "vk token response is empty"
		}
		return nil, apperrors.InvalidArguments.AddErrDetails(msg)
	}
	return &token, nil
}

func fetchVKProfile(ctx context.Context, cfg vkConfig, accessToken string, userID int64) (vkUser, error) {
	u, _ := url.Parse(vkUsersEndpoint)
	q := u.Query()
	q.Set("user_ids", strconv.FormatInt(userID, 10))
	q.Set("fields", "domain,photo_200,photo_200_orig,photo_max,photo_max_orig,photo_400_orig,photo_100,photo_100_orig")
	q.Set("access_token", accessToken)
	q.Set("v", cfg.apiVersion)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return vkUser{}, apperrors.Wrap(err)
	}
	resp, err := vkHTTPClient().Do(req)
	if err != nil {
		return vkUser{}, apperrors.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return vkUser{}, apperrors.ServerError.AddErrDetails("vk users.get failed")
	}
	var data vkUsersResponse
	if err := decodeJSON(resp.Body, &data); err != nil {
		return vkUser{}, apperrors.Wrap(err)
	}
	if data.Error != nil {
		return vkUser{}, apperrors.InvalidArguments.AddErrDetails(data.Error.ErrorMsg)
	}
	if len(data.Response) == 0 {
		return vkUser{}, apperrors.RecordNotFound
	}
	return data.Response[0], nil
}

func pickVKAvatar(profile vkUser) string {
	candidates := []string{
		profile.PhotoMaxOrig,
		profile.Photo400Orig,
		profile.Photo200Orig,
		profile.PhotoMax,
		profile.Photo200,
		profile.PhotoBaseOrig,
		profile.PhotoBase,
	}
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate) != "" {
			return candidate
		}
	}
	return ""
}

func generateVKState(secret string) (string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	data := token + "." + ts
	sig := signState(secret, data)
	return data + "." + sig, nil
}

func verifyVKState(secret string, ttl time.Duration, state string) error {
	parts := strings.Split(state, ".")
	if len(parts) != 3 {
		return errors.New("invalid state format")
	}
	data := parts[0] + "." + parts[1]
	expected := signState(secret, data)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return errors.New("invalid state signature")
	}
	ts, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return errors.New("invalid state timestamp")
	}
	now := time.Now().Unix()
	if ts > now+300 {
		return errors.New("state timestamp is in the future")
	}
	if now-ts > int64(ttl.Seconds()) {
		return errors.New("state expired")
	}
	return nil
}

func signState(secret string, data string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func randomToken(length int) (string, error) {
	if length <= 0 {
		return "", errors.New("length is invalid")
	}
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func generateRandomPassword(length int) (string, error) {
	const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	if length <= 0 {
		return "", errors.New("invalid length")
	}
	out := make([]byte, length)
	max := byte(len(alphabet))
	for i := range out {
		var b [1]byte
		if _, err := rand.Read(b[:]); err != nil {
			return "", err
		}
		out[i] = alphabet[b[0]%max]
	}
	return string(out), nil
}

func randomSuffix(length int) string {
	s, err := generateRandomPassword(length)
	if err != nil {
		return "0000"
	}
	return strings.ToLower(s)
}

func buildVKUsername(profile vkUser, linkedID string) string {
	domain := strings.TrimSpace(profile.Domain)
	if domain != "" {
		return domain
	}
	linkedID = strings.TrimSpace(linkedID)
	if linkedID == "" {
		return "vkuser"
	}
	return linkedID
}

func decodeJSON(body io.Reader, out any) error {
	dec := json.NewDecoder(body)
	return dec.Decode(out)
}

func vkHTTPClient() *http.Client {
	return &http.Client{Timeout: 10 * time.Second}
}

func isRecordNotFound(err error) bool {
	if err == nil {
		return false
	}
	var appErr apperrors.ErrorST
	if errors.As(err, &appErr) {
		return appErr.Is(apperrors.RecordNotFound)
	}
	return strings.Contains(strings.ToLower(err.Error()), "record not found")
}

func safeInt(v int64) int {
	if v <= 0 {
		return 0
	}
	if v > math.MaxInt {
		return 0
	}
	return int(v)
}
