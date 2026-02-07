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
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

const (
	vkAuthEndpoint     = "https://id.vk.ru/authorize"
	vkTokenEndpoint    = "https://id.vk.ru/oauth2/auth"
	vkUserInfoEndpoint = "https://id.vk.ru/oauth2/user_info"
	vkDefaultScope     = "email vkid.personal_info"
	vkDefaultAPI       = "5.131"
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

type vkUser struct {
	ID            int64  `json:"id"`
	FirstName     string `json:"first_name"`
	LastName      string `json:"last_name"`
	Email         string `json:"email"`
	Domain        string `json:"domain"`
	Photo200      string `json:"photo_200"`
	Photo200Orig  string `json:"photo_200_orig"`
	PhotoMax      string `json:"photo_max"`
	PhotoMaxOrig  string `json:"photo_max_orig"`
	Photo400Orig  string `json:"photo_400_orig"`
	PhotoBase     string `json:"photo_100"`
	PhotoBaseOrig string `json:"photo_100_orig"`
}

type vkUserInfoResponse struct {
	User         vkUser `json:"user"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
	ErrorMessage string `json:"error_msg"`
}

func (s *LoginService) VkStart(ctx context.Context, _ *emptypb.Empty) (*loginpb.VKStartResponse, error) {
	cfg, err := loadVKConfig(false)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, err
	}
	state, codeVerifier, err := generateVKState(cfg.stateSecret)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, apperrors.ServerError.AddErrDetails("failed to generate state")
	}
	codeChallenge := buildPKCEChallenge(codeVerifier)
	authURL := buildVKAuthURL(cfg, state, codeChallenge)
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
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, err
	}
	code := strings.TrimSpace(req.GetCode())
	state := strings.TrimSpace(req.GetState())
	deviceID := strings.TrimSpace(req.GetDeviceId())
	if code == "" || state == "" || deviceID == "" {
		logger.Debug("code or state or deviceID is missing", "")
		return nil, apperrors.RequiredDataMissing.AddErrDetails("code, state or device_id is empty")
	}
	codeVerifier, err := verifyVKState(cfg.stateSecret, cfg.stateTTL, state)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, apperrors.InvalidArguments.AddErrDetails("invalid vk state")
	}

	exchangeCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()

	tokenResp, err := exchangeVKCode(exchangeCtx, cfg, code, codeVerifier, deviceID)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, err
	}

	profile, err := fetchVKProfile(ctx, cfg, tokenResp.AccessToken)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, err
	}

	userID := tokenResp.UserID
	if profile.ID != 0 {
		userID = profile.ID
	}
	if userID == 0 {
		logger.Debug("user id is empty", "")
		return nil, apperrors.InvalidArguments.AddErrDetails("vk user id is empty")
	}

	email := strings.TrimSpace(profile.Email)
	if email == "" {
		email = strings.TrimSpace(tokenResp.Email)
	}
	if email == "" {
		logger.Debug("email is missing", "")
		return nil, apperrors.RequiredDataMissing.AddErrDetails("vk email is empty")
	}

	if s.verification != nil {
		banned, err := s.verification.IsBanned(ctx, email)
		if err != nil {
			logger.Debug("error appeared: "+err.Error(), "")
			return nil, apperrors.Wrap(err)
		}
		if banned {
			return nil, apperrors.AccessDenied.AddErrDetails("email is banned")
		}
	}

	linkedID := strconv.FormatInt(userID, 10)
	uid, err := s.login.GetOAuthUID(ctx, logindomain.OAuthServiceVK, linkedID)
	if err != nil && !isRecordNotFound(err) {
		logger.Debug("error appeared: "+err.Error(), "")
		return nil, apperrors.Wrap(err)
	}

	var generatedPassword string
	isNewUser := false
	if uid == nil || isRecordNotFound(err) {
		uid, err = s.login.GetUIDByEmail(ctx, email)
		if err != nil && !isRecordNotFound(err) {
			logger.Debug("error appeared: "+err.Error(), "")
			return nil, apperrors.Wrap(err)
		}
		if uid != nil && err == nil {
			if err := s.login.LinkOAuth(ctx, logindomain.OAuthServiceVK, linkedID, *uid); err != nil {
				logger.Debug("error appeared: "+err.Error(), "")
				return nil, apperrors.Wrap(err)
			}
		} else {
			generatedPassword, err = generateRandomPassword(16)
			if err != nil {
				logger.Debug("error appeared: "+err.Error(), "")
				return nil, apperrors.ServerError.AddErrDetails("failed to generate password")
			}
			username := buildVKUsername(profile, linkedID)
			uid, err = s.registerVKUser(ctx, username, email, generatedPassword)
			if err != nil {
				logger.Debug("error appeared: "+err.Error(), "")
				return nil, err
			}
			isNewUser = true
			if err := s.login.LinkOAuth(ctx, logindomain.OAuthServiceVK, linkedID, *uid); err != nil {
				logger.Debug("error appeared: "+err.Error(), "")
				return nil, apperrors.Wrap(err)
			}

			displayName := strings.TrimSpace(strings.Join([]string{profile.FirstName, profile.LastName}, " "))
			if displayName != "" && s.login.User != nil {
				if err := s.login.User.UpdateDisplayName(ctx, *uid, displayName); err != nil {
					logger.Debug("error appeared: "+err.Error(), "")
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
		logger.Debug("uid is empty", "")
		return nil, apperrors.ServerError.AddErrDetails("uid is empty")
	}

	if isNewUser && generatedPassword != "" {
		if s.verification == nil || s.verification.Mailer == nil {
			return nil, apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
		}
		mailCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if _, err := s.verification.Mailer.SendRegistrationPassword(mailCtx, email, generatedPassword); err != nil {
			logger.Debug("failed to send registration password: "+err.Error(), "login.vk.mailer")
		}
	}

	if err := s.issueAndStoreSession(ctx, *uid); err != nil {
		logger.Debug("error appeared: "+err.Error(), "")
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
	if successRedirect == "" && strings.TrimSpace(env.Mailer.Domain) != "" {
		successRedirect = "https://" + strings.TrimSpace(env.Mailer.Domain)
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

func buildVKAuthURL(cfg vkConfig, state string, codeChallenge string) string {
	u, _ := url.Parse(vkAuthEndpoint)
	q := u.Query()
	q.Set("client_id", cfg.clientID)
	q.Set("display", "page")
	q.Set("redirect_uri", cfg.redirectURI)
	q.Set("scope", cfg.scope)
	q.Set("response_type", "code")
	q.Set("state", state)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	q.Set("v", cfg.apiVersion)
	u.RawQuery = q.Encode()
	return u.String()
}

func exchangeVKCode(ctx context.Context, cfg vkConfig, code string, codeVerifier string, deviceID string) (*vkTokenResponse, error) {
	form := url.Values{}
	form.Set("client_id", cfg.clientID)
	if cfg.clientSecret != "" {
		form.Set("client_secret", cfg.clientSecret)
	}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", cfg.redirectURI)
	form.Set("code_verifier", codeVerifier)
	if strings.TrimSpace(deviceID) != "" {
		form.Set("device_id", deviceID)
	}
	payload := form.Encode()

	const maxRetries = 2
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, vkNetError("vk token exchange", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, vkTokenEndpoint, strings.NewReader(payload))
		if err != nil {
			return nil, apperrors.Wrap(err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "AesterialBackend/1.0")

		resp, err := vkHTTPClient().Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, vkNetError("vk token exchange", ctx.Err())
			}
			if attempt < maxRetries && isRetryableVKNetError(err) {
				lastErr = err
				time.Sleep(time.Duration(attempt+1) * 300 * time.Millisecond)
				continue
			}
			return nil, vkNetError("vk token exchange", err)
		}

		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			if attempt < maxRetries && isRetryableVKNetError(readErr) {
				lastErr = readErr
				time.Sleep(time.Duration(attempt+1) * 300 * time.Millisecond)
				continue
			}
			return nil, apperrors.Wrap(readErr)
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			msg := vkTokenErrorMessage(body)
			detail := fmt.Sprintf("status %d: %s", resp.StatusCode, msg)
			if resp.StatusCode >= 500 && attempt < maxRetries {
				lastErr = fmt.Errorf("vk token exchange %s", detail)
				time.Sleep(time.Duration(attempt+1) * 400 * time.Millisecond)
				continue
			}
			if resp.StatusCode >= 500 {
				return nil, apperrors.ServerError.AddErrDetails("vk token exchange failed: " + detail)
			}
			return nil, apperrors.InvalidArguments.AddErrDetails("vk token exchange failed: " + detail)
		}

		var token vkTokenResponse
		if err := json.Unmarshal(body, &token); err != nil {
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
				msg = token.ErrorReason
			}
			if msg == "" {
				msg = "vk token response is empty"
			}
			return nil, apperrors.InvalidArguments.AddErrDetails(msg)
		}
		return &token, nil
	}

	if lastErr != nil {
		return nil, vkNetError("vk token exchange", lastErr)
	}
	return nil, apperrors.ServerError.AddErrDetails("vk token exchange failed")
}

func fetchVKProfile(ctx context.Context, cfg vkConfig, accessToken string) (vkUser, error) {
	if err := ctx.Err(); err != nil {
		return vkUser{}, vkNetError("vk user info", err)
	}
	if strings.TrimSpace(accessToken) == "" {
		return vkUser{}, apperrors.RequiredDataMissing.AddErrDetails("vk access token is empty")
	}

	form := url.Values{}
	form.Set("access_token", accessToken)
	form.Set("client_id", cfg.clientID)
	payload := form.Encode()

	const maxRetries = 2
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return vkUser{}, vkNetError("vk user info", err)
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, vkUserInfoEndpoint, strings.NewReader(payload))
		if err != nil {
			return vkUser{}, apperrors.Wrap(err)
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "AesterialBackend/1.0")

		resp, err := vkHTTPClient().Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return vkUser{}, vkNetError("vk user info", ctx.Err())
			}
			if attempt < maxRetries && isRetryableVKNetError(err) {
				lastErr = err
				time.Sleep(time.Duration(attempt+1) * 300 * time.Millisecond)
				continue
			}
			return vkUser{}, vkNetError("vk user info", err)
		}

		body, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if readErr != nil {
			if attempt < maxRetries && isRetryableVKNetError(readErr) {
				lastErr = readErr
				time.Sleep(time.Duration(attempt+1) * 300 * time.Millisecond)
				continue
			}
			return vkUser{}, apperrors.Wrap(readErr)
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			msg := vkUserInfoErrorMessage(body)
			detail := fmt.Sprintf("status %d: %s", resp.StatusCode, msg)
			if resp.StatusCode >= 500 && attempt < maxRetries {
				lastErr = fmt.Errorf("vk user info %s", detail)
				time.Sleep(time.Duration(attempt+1) * 400 * time.Millisecond)
				continue
			}
			if resp.StatusCode >= 500 {
				return vkUser{}, apperrors.ServerError.AddErrDetails("vk user info failed: " + detail)
			}
			return vkUser{}, apperrors.InvalidArguments.AddErrDetails("vk user info failed: " + detail)
		}

		var info vkUserInfoResponse
		if err := json.Unmarshal(body, &info); err != nil {
			return vkUser{}, apperrors.Wrap(err)
		}
		if msg := strings.TrimSpace(info.Error); msg != "" {
			if info.ErrorMessage != "" {
				msg = info.ErrorMessage
			}
			if info.ErrorDesc != "" {
				msg = info.ErrorDesc
			}
			return vkUser{}, apperrors.InvalidArguments.AddErrDetails(msg)
		}
		if info.User.ID == 0 {
			return vkUser{}, apperrors.RecordNotFound
		}
		return info.User, nil
	}

	if lastErr != nil {
		return vkUser{}, vkNetError("vk user info", lastErr)
	}
	return vkUser{}, apperrors.ServerError.AddErrDetails("vk user info failed")
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

func generateVKState(secret string) (string, string, error) {
	token, err := randomToken(32)
	if err != nil {
		return "", "", err
	}
	codeVerifier, err := generatePKCEVerifier()
	if err != nil {
		return "", "", err
	}
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	data := token + "." + ts + "." + codeVerifier
	sig := signState(secret, data)
	return data + "." + sig, codeVerifier, nil
}

func verifyVKState(secret string, ttl time.Duration, state string) (string, error) {
	state = strings.TrimSpace(state)
	if state == "" {
		return "", status.New(codes.InvalidArgument, "invalid state format").Err()
	}

	validateTS := func(ts int64) error {
		now := time.Now().Unix()
		if ts > now+300 {
			return status.New(codes.InvalidArgument, "state timestamp is in the future").Err()
		}
		if now-ts > int64(ttl.Seconds()) {
			return status.New(codes.InvalidArgument, "state expired").Err()
		}
		return nil
	}

	if strings.Count(state, ".") == 3 {
		parts := strings.Split(state, ".")
		if len(parts) != 4 {
			return "", status.New(codes.InvalidArgument, "invalid state format").Err()
		}
		data := parts[0] + "." + parts[1] + "." + parts[2]
		expected := signState(secret, data)
		if !hmac.Equal([]byte(expected), []byte(parts[3])) {
			return "", status.New(codes.InvalidArgument, "invalid state signature").Err()
		}
		ts, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return "", status.New(codes.InvalidArgument, "invalid state timestamp").Err()
		}
		if err := validateTS(ts); err != nil {
			return "", err
		}
		codeVerifier := strings.TrimSpace(parts[2])
		if codeVerifier == "" {
			return "", status.New(codes.InvalidArgument, "state code verifier is empty").Err()
		}
		return codeVerifier, nil
	}

	isDigits10 := func(s string) bool {
		if len(s) != 10 {
			return false
		}
		for i := 0; i < 10; i++ {
			c := s[i]
			if c < '0' || c > '9' {
				return false
			}
		}
		return true
	}

	for i := 0; i+10 <= len(state); i++ {
		tsStr := state[i : i+10]
		if !isDigits10(tsStr) {
			continue
		}
		ts, err := strconv.ParseInt(tsStr, 10, 64)
		if err != nil {
			continue
		}
		if err := validateTS(ts); err != nil {
			continue
		}

		nonce := state[:i]
		tail := state[i+10:]
		if nonce == "" || tail == "" {
			continue
		}

		for _, sigLen := range []int{43, 44, 64} {
			if len(tail) <= sigLen {
				continue
			}
			verifier := strings.TrimSpace(tail[:len(tail)-sigLen])
			sig := tail[len(tail)-sigLen:]
			if verifier == "" {
				continue
			}

			data := nonce + "." + tsStr + "." + verifier
			expected := signState(secret, data)
			if hmac.Equal([]byte(expected), []byte(sig)) {
				return verifier, nil
			}
		}

		return "", status.New(codes.InvalidArgument, "invalid state signature").Err()
	}

	raw, err := base64.RawURLEncoding.DecodeString(state)
	if err == nil && len(raw) > sha256.Size {
		payload := raw[:len(raw)-sha256.Size]
		sig := raw[len(raw)-sha256.Size:]

		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write(payload)
		expectedSig := mac.Sum(nil)
		if !hmac.Equal(expectedSig, sig) {
			return "", status.New(codes.InvalidArgument, "invalid state signature").Err()
		}

		var p struct {
			TS int64  `json:"ts"`
			V  string `json:"v"`
		}
		if err := json.Unmarshal(payload, &p); err != nil {
			return "", status.New(codes.InvalidArgument, "invalid state format").Err()
		}
		if err := validateTS(p.TS); err != nil {
			return "", err
		}
		codeVerifier := strings.TrimSpace(p.V)
		if codeVerifier == "" {
			return "", status.New(codes.InvalidArgument, "state code verifier is empty").Err()
		}
		return codeVerifier, nil
	}

	return "", status.New(codes.InvalidArgument, "invalid state format").Err()
}

func generatePKCEVerifier() (string, error) {
	return randomToken(32)
}

func buildPKCEChallenge(codeVerifier string) string {
	sum := sha256.Sum256([]byte(codeVerifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
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

var vkHTTPClientInstance = &http.Client{
	Timeout: 25 * time.Second,
	Transport: &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:       10 * time.Second,
			KeepAlive:     30 * time.Second,
			FallbackDelay: 200 * time.Millisecond,
		}).DialContext,
		ForceAttemptHTTP2:     false,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 20 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12},
		TLSNextProto:          map[string]func(string, *tls.Conn) http.RoundTripper{},
	},
}

func vkHTTPClient() *http.Client {
	return vkHTTPClientInstance
}

func vkTokenErrorMessage(body []byte) string {
	var token vkTokenResponse
	if err := json.Unmarshal(body, &token); err == nil {
		msg := strings.TrimSpace(token.Error)
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorMessage)
		}
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorDesc)
		}
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorReason)
		}
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorMessageAlt)
		}
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorDescAlt)
		}
		if msg == "" {
			msg = strings.TrimSpace(token.ErrorReasonAlt)
		}
		if msg != "" {
			return msg
		}
	}
	raw := strings.TrimSpace(string(body))
	raw = redactVKSecrets(raw)
	if raw == "" {
		return "empty response"
	}
	const limit = 300
	if len(raw) > limit {
		return raw[:limit] + "..."
	}
	return raw
}

func vkUserInfoErrorMessage(body []byte) string {
	var info vkUserInfoResponse
	if err := json.Unmarshal(body, &info); err == nil {
		msg := strings.TrimSpace(info.Error)
		if msg == "" {
			msg = strings.TrimSpace(info.ErrorMessage)
		}
		if msg == "" {
			msg = strings.TrimSpace(info.ErrorDesc)
		}
		if msg != "" {
			return msg
		}
	}
	raw := strings.TrimSpace(string(body))
	raw = redactVKSecrets(raw)
	if raw == "" {
		return "empty response"
	}
	const limit = 300
	if len(raw) > limit {
		return raw[:limit] + "..."
	}
	return raw
}

func redactVKSecrets(value string) string {
	if value == "" {
		return value
	}
	keys := []string{"client_secret", "code_verifier", "code"}
	for _, key := range keys {
		value = redactKeyValue(value, key)
	}
	return value
}

func redactKeyValue(value string, key string) string {
	queryNeedle := key + "="
	for {
		idx := strings.Index(value, queryNeedle)
		if idx == -1 {
			break
		}
		start := idx + len(queryNeedle)
		end := start
		for end < len(value) {
			c := value[end]
			if c == '&' || c == ' ' || c == '\n' || c == '"' || c == '\'' {
				break
			}
			end++
		}
		value = value[:start] + "REDACTED" + value[end:]
	}

	jsonNeedle := `"` + key + `":"`
	for {
		idx := strings.Index(value, jsonNeedle)
		if idx == -1 {
			break
		}
		start := idx + len(jsonNeedle)
		end := start
		for end < len(value) && value[end] != '"' {
			end++
		}
		value = value[:start] + "REDACTED" + value[end:]
	}
	return value
}

func isRetryableVKNetError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return false
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		return true
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	return false
}

func vkNetError(prefix string, err error) error {
	if err == nil {
		return apperrors.Unavailable.AddErrDetails(prefix + " failed")
	}
	if errors.Is(err, context.Canceled) {
		return apperrors.Unavailable.AddErrDetails(prefix + " canceled")
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return apperrors.Unavailable.AddErrDetails(prefix + " timed out")
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return apperrors.Unavailable.AddErrDetails(prefix + " timed out")
	}
	return apperrors.Unavailable.AddErrDetails(prefix + " network error: " + err.Error())
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
