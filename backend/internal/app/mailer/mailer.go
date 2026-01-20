package mailer

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"fmt"
	"net/url"
	"strings"

	brevo "github.com/getbrevo/brevo-go/lib"
)

type Service struct {
	client    *brevo.APIClient
	fromName  string
	fromEmail string
}

func New(apiKey string, serviceName, serviceEmail string) *Service {
	cfg := brevo.NewConfiguration()
	cfg.AddDefaultHeader("api-key", apiKey)
	return &Service{
		client:    brevo.NewAPIClient(cfg),
		fromName:  strings.TrimSpace(serviceName),
		fromEmail: strings.TrimSpace(serviceEmail),
	}
}

func (s *Service) SendEmailVerify(ctx context.Context, email string, token string) (string, error) {
	cfg := config.Get()
	verifyURL := fmt.Sprintf(
		"https://%s/login/email-verify#token=%s",
		cfg.Cookies.Domain,
		url.QueryEscape(token),
	)

	em := brevo.SendSmtpEmail{
		Sender: &brevo.SendSmtpEmailSender{
			Name:  s.fromName,
			Email: s.fromEmail,
		},
		To:      []brevo.SendSmtpEmailTo{{Email: email}},
		Subject: "Email verification for " + cfg.Cookies.Domain,
		HtmlContent: fmt.Sprintf(
			`<p>Confirm your email via this link:</p><p><a href="%s">Confirm email</a></p>`,
			verifyURL,
		),
		TextContent: "Confirm your email via this link: " + verifyURL,
		Headers: map[string]any{
			"idempotencyKey": "verify:" + email + ":" + token,
		},
		Tags: []string{"auth", "verify_email"},
	}

	resp, _, err := s.client.TransactionalEmailsApi.SendTransacEmail(ctx, em)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "mailer.send_email_verify")
		return "", apperrors.Wrap(err)
	}
	return resp.MessageId, nil
}

func (s *Service) SendPasswordReset(ctx context.Context, email string, token string) (string, error) {
	cfg := config.Get()
	resetUrl := fmt.Sprintf("https://%s/login/reset-password#token=%s", cfg.Cookies.Domain, url.QueryEscape(token))

	em := brevo.SendSmtpEmail{
		Sender: &brevo.SendSmtpEmailSender{
			Name:  s.fromName,
			Email: s.fromEmail,
		},
		To:      []brevo.SendSmtpEmailTo{{Email: email}},
		Subject: "Password reset for " + cfg.Cookies.Domain,
		HtmlContent: fmt.Sprintf(
			`<p>Reset your password via this link:</p><p><a href="%s">Reset password</a></p>`,
			resetUrl,
		),
		TextContent: "Reset your password via this link: " + resetUrl,
		Headers: map[string]any{
			"idempotencyKey": "reset:" + email + ":" + token,
		},
		Tags: []string{"auth", "reset_password"},
	}
	resp, _, err := s.client.TransactionalEmailsApi.SendTransacEmail(ctx, em)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "mailer.send_password_reset")
		return "", apperrors.Wrap(err)
	}
	return resp.MessageId, nil
}
