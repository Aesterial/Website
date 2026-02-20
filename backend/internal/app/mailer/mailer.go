package mailer

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/domain/mailer"
	mailproxyv1 "Aesterial/backend/internal/gen/mailproxy/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"crypto/tls"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

const (
	defaultProxyAddr      = "proxy.mail.aesterial.xyz:443"
	defaultProxyServerTLS = "proxy.mail.aesterial.xyz"
)

type Config struct {
	ProxyAddr                  string
	ProxyTLSEnabled            bool
	ProxyTLSServerName         string
	ProxyTLSInsecureSkipVerify bool
	DialTimeout                time.Duration
	RequestTimeout             time.Duration
	AuthToken                  string
}

type Service struct {
	proxyAddr                  string
	proxyTLSEnabled            bool
	proxyTLSServerName         string
	proxyTLSInsecureSkipVerify bool
	dialTimeout                time.Duration
	requestTimeout             time.Duration
	authToken                  string
}

func New(cfg Config) *Service {
	proxyAddr := strings.TrimSpace(cfg.ProxyAddr)
	if proxyAddr == "" {
		proxyAddr = defaultProxyAddr
	}

	proxyServerName := strings.TrimSpace(cfg.ProxyTLSServerName)
	if proxyServerName == "" {
		proxyServerName = defaultProxyServerTLS
	}

	dialTimeout := cfg.DialTimeout
	if dialTimeout <= 0 {
		dialTimeout = 8 * time.Second
	}

	requestTimeout := cfg.RequestTimeout
	if requestTimeout <= 0 {
		requestTimeout = 15 * time.Second
	}

	return &Service{
		proxyAddr:                  proxyAddr,
		proxyTLSEnabled:            cfg.ProxyTLSEnabled,
		proxyTLSServerName:         proxyServerName,
		proxyTLSInsecureSkipVerify: cfg.ProxyTLSInsecureSkipVerify,
		dialTimeout:                dialTimeout,
		requestTimeout:             requestTimeout,
		authToken:                  strings.TrimSpace(cfg.AuthToken),
	}
}

func (s *Service) SendTicketCreation(ctx context.Context, email string, id string, content string, lang string) (string, error) {
	ticketID := "#" + id
	ticketurl := "https://aesterial.xyz/support/" + id
	subject := "Ticket " + ticketID + "created"
	textBody := "Ticket " + ticketID + " created by you. " + "Link: " + ticketurl
	return s.sendMail(ctx, email, subject, mailer.Get(mailer.TickerCreation, lang).SetRedirectUrl(ticketurl).SetCustom(map[string]string{"date": time.Now().String(), "content": content}).String(), textBody)
}

func (s *Service) SendTicketClose(ctx context.Context, email string, id string, reason string) (string, error) {
	ticketID := "#" + id
	subject := "Ticket " + ticketID + "closed"
	htmlBody := fmt.Sprintf(
		`<p>Ticket %s closed with reason: %s</p>`, ticketID, reason,
	)
	textBody := "Ticket " + ticketID + " closed with reason: " + reason
	return s.sendMail(ctx, email, subject, htmlBody, textBody)
}

func (s *Service) SendTicketMessage(ctx context.Context, email string, id string, name string, content string) (string, error) {
	ticketID := "#" + id
	subject := "New Message in Ticket " + ticketID
	htmlBody := fmt.Sprintf(
		`<p>%s sent a message with content: %s, at: %s</p>`,
		name, content, time.Now().String(),
	)
	textBody := fmt.Sprintf(`<p>%s sent a message with content: %s, at: %s</p>`, name, content, time.Now().String())
	return s.sendMail(ctx, email, subject, htmlBody, textBody)
}

func (s *Service) SendEmailVerify(ctx context.Context, email string, token string, lang string) (string, error) {
	cfg := config.Get()
	verifyURL := fmt.Sprintf(
		"https://%s/login/email-verify#token=%s",
		cfg.Mailer.Domain,
		url.QueryEscape(token),
	)
	subject := "Email verification for account"
	textBody := "Confirm your email via this link: " + verifyURL
	return s.sendMail(ctx, email, subject, mailer.Get(mailer.VerifyEmail, lang).SetRedirectUrl(verifyURL).Normalize().String(), textBody)
}

func (s *Service) SendPasswordReset(ctx context.Context, email string, token string, lang string) (string, error) {
	cfg := config.Get()
	resetUrl := fmt.Sprintf("https://%s/login/reset-password#token=%s", cfg.Mailer.Domain, url.QueryEscape(token))

	subject := "Password reset for " + cfg.Mailer.Domain
	textBody := "Reset your password via this link: " + resetUrl
	return s.sendMail(ctx, email, subject, mailer.Get(mailer.ResetPassword, lang).SetRedirectUrl(resetUrl).Normalize().String(), textBody)
}

func (s *Service) SendRegistrationPassword(ctx context.Context, email string, password string) (string, error) {
	if strings.TrimSpace(password) == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("password is empty")
	}
	cfg := config.Get()
	loginUrl := fmt.Sprintf("https://%s/login", cfg.Mailer.Domain)
	subject := "Thanks for registration"
	htmlBody := fmt.Sprintf(
		`<p>Your account has been created via VK.</p><p>Password: <strong>%s</strong></p><p>You can log in here: <a href="%s">%s</a></p>`,
		password,
		loginUrl,
		loginUrl,
	)
	textBody := "Your account has been created via VK.\nPassword: " + password + "\nLogin: " + loginUrl

	return s.sendMail(ctx, email, subject, htmlBody, textBody)
}

func (s *Service) SendWelcome(ctx context.Context, email string, username string, lang string) (string, error) {
	if username == "" {
		return "", apperrors.InvalidArguments
	}
	cfg := config.Get()
	subject := "Thanks for registration"
	textBody := "Thank you for registration on Aesterial"
	return s.sendMail(ctx, email, subject, mailer.Get(mailer.Welcome, lang).SetRedirectUrl(cfg.URLs.Main).Normalize().String(), textBody)
}

func (s *Service) sendMail(ctx context.Context, to string, subject string, htmlBody string, textBody string) (string, error) {
	to = strings.TrimSpace(to)
	if to == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("email is empty")
	}
	if htmlBody == "" && textBody == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("email body is empty")
	}
	if err := s.validateConfig(); err != nil {
		return "", err
	}

	if ctx == nil {
		ctx = context.Background()
	}
	reqCtx := ctx
	var cancel context.CancelFunc
	if _, ok := reqCtx.Deadline(); !ok {
		reqCtx, cancel = context.WithTimeout(reqCtx, s.requestTimeout)
		defer cancel()
	}

	conn, err := s.dial(reqCtx)
	if err != nil {
		logger.Debug("mail proxy dial failed: "+err.Error(), "mailer.send")
		return "", apperrors.Unavailable.AddErrDetails("failed to connect mail proxy")
	}
	defer conn.Close()

	client := mailproxyv1.NewMailProxyServiceClient(conn)
	requestID := uuid.NewString()

	resp, err := client.SendEmail(reqCtx, &mailproxyv1.SendEmailRequest{
		RequestId: requestID,
		To:        to,
		Subject:   subject,
		HtmlBody:  htmlBody,
		TextBody:  textBody,
		AuthToken: s.authToken,
		Headers: map[string]string{
			"X-Mailer-Service": "aesterial-backend",
		},
	})
	if err != nil {
		st, ok := status.FromError(err)
		if !ok {
			logger.Debug("mail proxy send failed: "+err.Error(), "mailer.send")
			return "", apperrors.Unavailable.AddErrDetails("mail proxy unavailable")
		}

		logger.Debug("mail proxy send failed: "+st.Message(), "mailer.send")
		switch st.Code() {
		case codes.InvalidArgument:
			return "", apperrors.RequiredDataMissing.AddErrDetails(st.Message())
		case codes.FailedPrecondition:
			return "", apperrors.NotConfigured.AddErrDetails(st.Message())
		case codes.Unavailable, codes.DeadlineExceeded:
			return "", apperrors.Unavailable.AddErrDetails("mail proxy unavailable")
		default:
			return "", apperrors.ServerError.AddErrDetails(st.Message())
		}
	}

	messageID := strings.TrimSpace(resp.GetMessageId())
	if messageID == "" {
		return "", apperrors.Unavailable.AddErrDetails("mail proxy returned empty message id")
	}

	return messageID, nil
}

func (s *Service) dial(ctx context.Context) (*grpc.ClientConn, error) {
	dialCtx, cancel := context.WithTimeout(ctx, s.dialTimeout)
	defer cancel()

	opts := []grpc.DialOption{
		grpc.WithBlock(),
	}

	if s.proxyTLSEnabled {
		creds := credentials.NewTLS(&tls.Config{
			ServerName:         s.proxyTLSServerName,
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: s.proxyTLSInsecureSkipVerify,
		})
		opts = append(opts, grpc.WithTransportCredentials(creds))
	} else {
		opts = append(opts, grpc.WithTransportCredentials(insecure.NewCredentials()))
	}

	return grpc.DialContext(dialCtx, s.proxyAddr, opts...)
}

func (s *Service) validateConfig() error {
	if s == nil {
		return apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
	}
	if s.proxyAddr == "" {
		return apperrors.NotConfigured.AddErrDetails("mail proxy address is empty")
	}
	if s.proxyTLSEnabled && s.proxyTLSServerName == "" {
		return apperrors.NotConfigured.AddErrDetails("mail proxy tls server name is empty")
	}
	if s.dialTimeout <= 0 {
		return apperrors.NotConfigured.AddErrDetails("mail proxy dial timeout is empty")
	}
	if s.requestTimeout <= 0 {
		return apperrors.NotConfigured.AddErrDetails("mail proxy request timeout is empty")
	}
	if s.authToken == "" {
		return apperrors.NotConfigured.AddErrDetails("mail proxy auth token is empty")
	}
	return nil
}
