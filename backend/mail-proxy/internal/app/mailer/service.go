package mailer

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidConfig  = errors.New("invalid mailer config")
	ErrInvalidMessage = errors.New("invalid mailer message")
	ErrUnavailable    = errors.New("mailer unavailable")
)

type Config struct {
	Host        string
	Port        int
	User        string
	Pass        string
	FromName    string
	FromEmail   string
	ReplyTo     string
	Secure      bool
	StartTLS    bool
	DialTimeout time.Duration
	SendTimeout time.Duration
}

type Message struct {
	To       string
	Subject  string
	HTMLBody string
	TextBody string
	Headers  map[string]string
}

type Service struct {
	host        string
	port        int
	user        string
	pass        string
	fromName    string
	fromEmail   string
	replyTo     string
	secure      bool
	startTLS    bool
	dialTimeout time.Duration
	sendTimeout time.Duration
}

func New(cfg Config) (*Service, error) {
	service := &Service{
		host:        strings.TrimSpace(cfg.Host),
		port:        cfg.Port,
		user:        strings.TrimSpace(cfg.User),
		pass:        cfg.Pass,
		fromName:    strings.TrimSpace(cfg.FromName),
		fromEmail:   strings.TrimSpace(cfg.FromEmail),
		replyTo:     strings.TrimSpace(cfg.ReplyTo),
		secure:      cfg.Secure,
		startTLS:    cfg.StartTLS,
		dialTimeout: cfg.DialTimeout,
		sendTimeout: cfg.SendTimeout,
	}

	if err := service.validateConfig(); err != nil {
		return nil, err
	}

	return service, nil
}

func (s *Service) Send(ctx context.Context, msg Message) (string, error) {
	if err := validateMessage(msg); err != nil {
		return "", err
	}

	messageID := fmt.Sprintf("<%s@aesterial-mail-proxy>", uuid.NewString())
	contentType, body := buildBody(msg.HTMLBody, msg.TextBody)

	headers := []string{
		"From: " + formatAddress(s.fromName, s.fromEmail),
		"To: " + sanitizeHeaderValue(msg.To),
		"Subject: " + sanitizeHeaderValue(msg.Subject),
		"Message-ID: " + messageID,
		"Date: " + time.Now().Format(time.RFC1123Z),
		"Reply-To: " + sanitizeHeaderValue(s.replyTo),
		"MIME-Version: 1.0",
		"Content-Type: " + contentType,
	}

	for key, value := range msg.Headers {
		canonicalKey := textproto.CanonicalMIMEHeaderKey(strings.TrimSpace(key))
		if canonicalKey == "" || strings.ContainsAny(canonicalKey, "\r\n:") {
			continue
		}
		headers = append(headers, canonicalKey+": "+sanitizeHeaderValue(value))
	}

	var payload bytes.Buffer
	for _, header := range headers {
		payload.WriteString(header)
		payload.WriteString("\r\n")
	}
	payload.WriteString("\r\n")
	payload.WriteString(body)

	sendCtx := ctx
	if sendCtx == nil {
		sendCtx = context.Background()
	}
	if _, ok := sendCtx.Deadline(); !ok {
		var cancel context.CancelFunc
		sendCtx, cancel = context.WithTimeout(sendCtx, s.sendTimeout)
		defer cancel()
	}

	if err := s.smtpSend(sendCtx, strings.TrimSpace(msg.To), payload.Bytes()); err != nil {
		return "", fmt.Errorf("%w: %v", ErrUnavailable, err)
	}

	return messageID, nil
}

func (s *Service) smtpSend(ctx context.Context, to string, payload []byte) error {
	address := net.JoinHostPort(s.host, strconv.Itoa(s.port))
	dialer := &net.Dialer{Timeout: s.dialTimeout}

	var conn net.Conn
	var err error
	if s.secure {
		conn, err = tls.DialWithDialer(dialer, "tcp", address, &tls.Config{
			ServerName: s.host,
			MinVersion: tls.VersionTLS12,
		})
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", address)
	}
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("smtp new client: %w", err)
	}
	defer client.Close()

	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = client.Close()
		case <-done:
		}
	}()
	defer close(done)

	if s.startTLS {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return fmt.Errorf("smtp starttls: unsupported by server")
		}

		if err := client.StartTLS(&tls.Config{
			ServerName: s.host,
			MinVersion: tls.VersionTLS12,
		}); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}

	auth := smtp.PlainAuth("", s.user, s.pass, s.host)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}

	if err := client.Mail(s.fromEmail); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}

	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := writer.Write(payload); err != nil {
		_ = writer.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp data close: %w", err)
	}

	return client.Quit()
}

func (s *Service) validateConfig() error {
	switch {
	case s.host == "":
		return fmt.Errorf("%w: smtp host is empty", ErrInvalidConfig)
	case s.port <= 0:
		return fmt.Errorf("%w: smtp port must be > 0", ErrInvalidConfig)
	case s.user == "":
		return fmt.Errorf("%w: smtp user is empty", ErrInvalidConfig)
	case strings.TrimSpace(s.pass) == "":
		return fmt.Errorf("%w: smtp pass is empty", ErrInvalidConfig)
	case s.fromEmail == "":
		return fmt.Errorf("%w: from email is empty", ErrInvalidConfig)
	case s.replyTo == "":
		return fmt.Errorf("%w: reply-to is empty", ErrInvalidConfig)
	case s.secure && s.startTLS:
		return fmt.Errorf("%w: secure and starttls cannot both be enabled", ErrInvalidConfig)
	case s.dialTimeout <= 0:
		return fmt.Errorf("%w: dial timeout must be > 0", ErrInvalidConfig)
	case s.sendTimeout <= 0:
		return fmt.Errorf("%w: send timeout must be > 0", ErrInvalidConfig)
	default:
		return nil
	}
}

func validateMessage(msg Message) error {
	to := strings.TrimSpace(msg.To)
	if to == "" {
		return fmt.Errorf("%w: recipient email is empty", ErrInvalidMessage)
	}
	if !strings.Contains(to, "@") {
		return fmt.Errorf("%w: recipient email is invalid", ErrInvalidMessage)
	}
	if strings.TrimSpace(msg.Subject) == "" {
		return fmt.Errorf("%w: subject is empty", ErrInvalidMessage)
	}
	if strings.TrimSpace(msg.HTMLBody) == "" && strings.TrimSpace(msg.TextBody) == "" {
		return fmt.Errorf("%w: body is empty", ErrInvalidMessage)
	}
	return nil
}

func buildBody(htmlBody string, textBody string) (string, string) {
	if htmlBody != "" && textBody != "" {
		boundary := "alt-" + uuid.NewString()
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
	if strings.TrimSpace(name) == "" {
		return email
	}
	return fmt.Sprintf("%s <%s>", sanitizeHeaderValue(name), email)
}

func sanitizeHeaderValue(value string) string {
	value = strings.ReplaceAll(value, "\r", "")
	value = strings.ReplaceAll(value, "\n", "")
	return strings.TrimSpace(value)
}
