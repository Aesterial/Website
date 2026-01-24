package mailer

import (
	"Aesterial/backend/internal/app/config"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	transactionalFrom = "no-reply@aesterial.xyz"
	replyToEmail      = "support@aesterial.xyz"
)

type Config struct {
	Host     string
	Port     int
	User     string
	Pass     string
	FromName string
	Secure   bool
}

type Service struct {
	host     string
	port     int
	user     string
	pass     string
	fromName string
	secure   bool
}

func New(cfg Config) *Service {
	return &Service{
		host:     strings.TrimSpace(cfg.Host),
		port:     cfg.Port,
		user:     strings.TrimSpace(cfg.User),
		pass:     cfg.Pass,
		fromName: strings.TrimSpace(cfg.FromName),
		secure:   cfg.Secure,
	}
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

func (s *Service) SendEmailVerify(ctx context.Context, email string, token string) (string, error) {
	cfg := config.Get()
	verifyURL := fmt.Sprintf(
		"https://%s/login/email-verify#token=%s",
		cfg.Cookies.Domain,
		url.QueryEscape(token),
	)
	subject := "Email verification for " + cfg.Cookies.Domain
	htmlBody := fmt.Sprintf(
		`<p>Confirm your email via this link:</p><p><a href="%s">Confirm email</a></p>`,
		verifyURL,
	)
	textBody := "Confirm your email via this link: " + verifyURL

	return s.sendMail(ctx, email, subject, htmlBody, textBody)
}

func (s *Service) SendPasswordReset(ctx context.Context, email string, token string) (string, error) {
	cfg := config.Get()
	resetUrl := fmt.Sprintf("https://%s/login/reset-password#token=%s", cfg.Cookies.Domain, url.QueryEscape(token))

	subject := "Password reset for " + cfg.Cookies.Domain
	htmlBody := fmt.Sprintf(
		`<p>Reset your password via this link:</p><p><a href="%s">Reset password</a></p>`,
		resetUrl,
	)
	textBody := "Reset your password via this link: " + resetUrl

	return s.sendMail(ctx, email, subject, htmlBody, textBody)
}

func (s *Service) SendRegistrationPassword(ctx context.Context, email string, password string) (string, error) {
	if strings.TrimSpace(password) == "" {
		return "", apperrors.RequiredDataMissing.AddErrDetails("password is empty")
	}
	cfg := config.Get()
	loginUrl := fmt.Sprintf("https://%s/login", cfg.Cookies.Domain)
	subject := "Welcome to " + cfg.Cookies.Domain
	htmlBody := fmt.Sprintf(
		`<p>Your account has been created via VK.</p><p>Password: <strong>%s</strong></p><p>You can log in here: <a href="%s">%s</a></p>`,
		password,
		loginUrl,
		loginUrl,
	)
	textBody := "Your account has been created via VK.\nPassword: " + password + "\nLogin: " + loginUrl

	return s.sendMail(ctx, email, subject, htmlBody, textBody)
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

	messageID := fmt.Sprintf("<%s@aesterial.xyz>", uuid.New().String())
	contentType, body := buildBody(htmlBody, textBody)

	headers := []string{
		"From: " + formatAddress(s.fromName, transactionalFrom),
		"To: " + to,
		"Subject: " + subject,
		"Message-ID: " + messageID,
		"Date: " + time.Now().Format(time.RFC1123Z),
		"Reply-To: " + replyToEmail,
		"MIME-Version: 1.0",
		"Content-Type: " + contentType,
	}

	var msg bytes.Buffer
	for _, header := range headers {
		msg.WriteString(header)
		msg.WriteString("\r\n")
	}
	msg.WriteString("\r\n")
	msg.WriteString(body)

	if err := s.smtpSend(ctx, to, msg.Bytes()); err != nil {
		logger.Debug("smtp send failed: "+err.Error(), "mailer.send")
		return "", apperrors.Unavailable.AddErrDetails("failed to send email")
	}

	return messageID, nil
}

func (s *Service) validateConfig() error {
	if s == nil {
		return apperrors.NotConfigured.AddErrDetails("mailer service is not configured")
	}
	if s.host == "" {
		return apperrors.NotConfigured.AddErrDetails("smtp host is empty")
	}
	if s.port == 0 {
		return apperrors.NotConfigured.AddErrDetails("smtp port is empty")
	}
	if s.user == "" {
		return apperrors.NotConfigured.AddErrDetails("smtp user is empty")
	}
	if s.pass == "" {
		return apperrors.NotConfigured.AddErrDetails("smtp pass is empty")
	}
	if !strings.EqualFold(s.user, transactionalFrom) {
		return apperrors.NotConfigured.AddErrDetails("smtp user must be " + transactionalFrom)
	}
	return nil
}

func buildBody(htmlBody string, textBody string) (string, string) {
	if htmlBody != "" && textBody != "" {
		boundary := "alt-" + uuid.New().String()
		var body strings.Builder
		body.WriteString("--" + boundary + "\r\n")
		body.WriteString("Content-Type: text/plain; charset=\"UTF-8\"\r\n")
		body.WriteString("Content-Transfer-Encoding: 7bit\r\n\r\n")
		body.WriteString(textBody + "\r\n")
		body.WriteString("--" + boundary + "\r\n")
		body.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
		body.WriteString("Content-Transfer-Encoding: 7bit\r\n\r\n")
		body.WriteString(htmlBody + "\r\n")
		body.WriteString("--" + boundary + "--")
		return "multipart/alternative; boundary=" + boundary, body.String()
	}
	if htmlBody != "" {
		return "text/html; charset=\"UTF-8\"", htmlBody
	}
	return "text/plain; charset=\"UTF-8\"", textBody
}

func formatAddress(name string, email string) string {
	if name == "" {
		return email
	}
	return fmt.Sprintf("%s <%s>", name, email)
}

func (s *Service) smtpSend(ctx context.Context, to string, msg []byte) error {
	addr := fmt.Sprintf("%s:%d", s.host, s.port)
	dialer := &net.Dialer{Timeout: 10 * time.Second}

	var conn net.Conn
	var err error

	if s.secure {
		tlsConfig := &tls.Config{ServerName: s.host}
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsConfig)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return err
	}

	if err := applyDeadline(ctx, conn); err != nil {
		_ = conn.Close()
		return err
	}

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer client.Close()

	if !s.secure {
		if ok, _ := client.Extension("STARTTLS"); ok {
			tlsConfig := &tls.Config{ServerName: s.host}
			if err := client.StartTLS(tlsConfig); err != nil {
				return err
			}
		}
	}

	auth := smtp.PlainAuth("", s.user, s.pass, s.host)
	if err := client.Auth(auth); err != nil {
		return err
	}

	if err := client.Mail(transactionalFrom); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(msg); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func applyDeadline(ctx context.Context, conn net.Conn) error {
	if deadline, ok := ctx.Deadline(); ok {
		return conn.SetDeadline(deadline)
	}
	return conn.SetDeadline(time.Now().Add(30 * time.Second))
}
