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

	logger.Debug("sending to: "+to, "")

	if err := s.smtpSend(ctx, to, msg.Bytes()); err != nil {
		logger.Debug("smtp send failed: "+err.Error(), "mailer.send")
		return "", apperrors.Unavailable.AddErrDetails("failed to send email")
	}

	return messageID, nil
}

func (s *Service) smtpSend(ctx context.Context, to string, msg []byte) error {
	host := s.env.Mailer.Host
	port := s.env.Mailer.Port

	addr := net.JoinHostPort(host, strconv.Itoa(port))

	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	})
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()

	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = c.Close()
		case <-done:
		}
	}()
	defer close(done)

	if s.env.Mailer.User != "" {
		auth := smtp.PlainAuth("", s.env.Mailer.User, s.env.Mailer.Pass, host)
		if err := c.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := c.Mail(transactionalFrom); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := c.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp data close: %w", err)
	}

	return c.Quit()
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

func applyDeadline(ctx context.Context, conn net.Conn) error {
	if deadline, ok := ctx.Deadline(); ok {
		return conn.SetDeadline(deadline)
	}
	return conn.SetDeadline(time.Now().Add(30 * time.Second))
}
