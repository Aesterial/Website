package mailproxy

import (
	"context"
	"errors"
	"strings"

	"Aesterial/backend/mailproxy/internal/app/mailer"
	mailproxyv1 "Aesterial/backend/mailproxy/internal/gen/proto/mailproxy/v1"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Service struct {
	mailproxyv1.UnimplementedMailProxyServiceServer
	mailer    *mailer.Service
	authToken string
}

func NewService(mailerService *mailer.Service, authToken string) *Service {
	return &Service{
		mailer:    mailerService,
		authToken: strings.TrimSpace(authToken),
	}
}

func (s *Service) SendEmail(ctx context.Context, req *mailproxyv1.SendEmailRequest) (*mailproxyv1.SendEmailResponse, error) {
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request is nil")
	}
	if s.authToken == "" {
		return nil, status.Error(codes.FailedPrecondition, "mail proxy auth token is not configured")
	}
	if strings.TrimSpace(req.GetAuthToken()) != s.authToken {
		return nil, status.Error(codes.Unauthenticated, "invalid auth token")
	}

	headers := make(map[string]string, len(req.GetHeaders())+1)
	for key, value := range req.GetHeaders() {
		headers[key] = value
	}
	if requestID := strings.TrimSpace(req.GetRequestId()); requestID != "" {
		headers["X-Request-Id"] = requestID
	}

	messageID, err := s.mailer.Send(ctx, mailer.Message{
		To:       req.GetTo(),
		Subject:  req.GetSubject(),
		HTMLBody: req.GetHtmlBody(),
		TextBody: req.GetTextBody(),
		Headers:  headers,
	})
	if err != nil {
		switch {
		case errors.Is(err, mailer.ErrInvalidMessage):
			return nil, status.Error(codes.InvalidArgument, err.Error())
		case errors.Is(err, mailer.ErrInvalidConfig):
			return nil, status.Error(codes.FailedPrecondition, err.Error())
		case errors.Is(err, mailer.ErrUnavailable):
			return nil, status.Error(codes.Unavailable, "mailer provider unavailable")
		default:
			return nil, status.Error(codes.Internal, "failed to send email")
		}
	}

	return &mailproxyv1.SendEmailResponse{
		MessageId: messageID,
	}, nil
}
