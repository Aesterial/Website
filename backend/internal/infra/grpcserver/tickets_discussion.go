package grpcserver

import (
	"Aesterial/backend/internal/domain/permissions"
	ticketsdomain "Aesterial/backend/internal/domain/tickets"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

func (t *TicketsService) canManageTicketMessages(ctx context.Context, id uuid.UUID, uid uint) (bool, error) {
	if t == nil || t.auth == nil || t.serv == nil {
		return false, apperrors.NotConfigured
	}
	strongPerms := []permissions.Permission{
		permissions.TicketsAll,
		permissions.TicketsMessageCreateAll,
		permissions.TicketsMessageCreateAny,
		permissions.TicketsCloseAll,
		permissions.TicketsCloseAny,
	}
	for _, perm := range strongPerms {
		if err := t.auth.RequirePermissions(ctx, uid, perm); err == nil {
			return true, nil
		} else if !errors.Is(err, apperrors.AccessDenied) {
			return false, err
		}
	}

	acceptedPerms := []permissions.Permission{
		permissions.TicketsMessageCreateAccepted,
		permissions.TicketsCloseAccepted,
	}
	hasAcceptedPermission := false
	for _, perm := range acceptedPerms {
		if err := t.auth.RequirePermissions(ctx, uid, perm); err == nil {
			hasAcceptedPermission = true
			break
		} else if !errors.Is(err, apperrors.AccessDenied) {
			return false, err
		}
	}
	if !hasAcceptedPermission {
		return false, nil
	}

	info, err := t.serv.Info(ctx, id)
	if err != nil {
		return false, apperrors.Wrap(err)
	}
	return info != nil && info.Acceptor != nil && info.Acceptor.UID == uid, nil
}

func (t *TicketsService) discussionMessageActor(ctx context.Context, token *string) (*ticketsdomain.TicketDataReq, *uint, error) {
	req := &ticketsdomain.TicketDataReq{}
	if authUser, err := t.auth.RequireUser(ctx); err == nil && authUser != nil {
		req.UID = &authUser.UID
		return req, &authUser.UID, nil
	} else if err != nil &&
		!errors.Is(err, apperrors.InvalidArguments) &&
		!errors.Is(err, apperrors.Unauthenticated) &&
		!errors.Is(err, apperrors.AccessDenied) {
		return nil, nil, apperrors.Wrap(err)
	}
	if token == nil || strings.TrimSpace(*token) == "" {
		return nil, nil, apperrors.RequiredDataMissing.AddErrDetails("token is required")
	}
	val := strings.TrimSpace(*token)
	req.Token = &val
	return req, nil, nil
}

func (t *TicketsService) DiscussionMessages(ctx context.Context, id uuid.UUID, token *string, includeDeleted bool) (ticketsdomain.TicketMessages, error) {
	if t == nil || t.serv == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("tickets service not configured")
	}
	access, err := t.hasAccess(ctx, id, token)
	if err != nil {
		return nil, apperrors.Wrap(err)
	}
	if !access {
		return nil, apperrors.AccessDenied
	}
	if includeDeleted {
		return t.serv.MessagesAll(ctx, id)
	}
	return t.serv.Messages(ctx, id)
}

func (t *TicketsService) DiscussionEditMessage(ctx context.Context, id uuid.UUID, messageID int64, token *string, content string) error {
	if t == nil || t.serv == nil {
		return apperrors.NotConfigured.AddErrDetails("tickets service not configured")
	}
	if strings.TrimSpace(content) == "" {
		return apperrors.RequiredDataMissing.AddErrDetails("content is required")
	}
	req, _, err := t.discussionMessageActor(ctx, token)
	if err != nil {
		return err
	}
	if err := t.serv.EditMessage(ctx, id, messageID, content, *req); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}

func (t *TicketsService) DiscussionDeleteMessage(ctx context.Context, id uuid.UUID, messageID int64, token *string) error {
	if t == nil || t.serv == nil {
		return apperrors.NotConfigured.AddErrDetails("tickets service not configured")
	}
	req, uid, err := t.discussionMessageActor(ctx, token)
	if err != nil {
		return err
	}

	isOwner, err := t.serv.IsMessageOwner(ctx, id, messageID, *req)
	if err != nil {
		return apperrors.Wrap(err)
	}
	if !isOwner {
		if uid == nil {
			return apperrors.AccessDenied
		}
		allowed, err := t.canManageTicketMessages(ctx, id, *uid)
		if err != nil {
			return apperrors.Wrap(err)
		}
		if !allowed {
			return apperrors.AccessDenied
		}
	}
	if err := t.serv.DeleteMessage(ctx, id, messageID, uid); err != nil {
		return apperrors.Wrap(err)
	}
	return nil
}
