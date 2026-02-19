package grpcserver

import (
	userpb "Aesterial/backend/internal/gen/user/v1"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
)

type discussionMutationRequest struct {
	Content string `json:"content"`
	Token   string `json:"token"`
}

type discussionMessageResponse struct {
	ID        string             `json:"id"`
	Message   string             `json:"message"`
	Content   string             `json:"content"`
	Author    *userpb.UserPublic `json:"author,omitempty"`
	At        *time.Time         `json:"at,omitempty"`
	EditedAt  *time.Time         `json:"editedAt,omitempty"`
	DeletedAt *time.Time         `json:"deletedAt,omitempty"`
	DeletedBy *uint              `json:"deletedBy,omitempty"`
	Deleted   bool               `json:"deleted"`
}

type discussionListResponse struct {
	List    []discussionMessageResponse `json:"list"`
	Tracing string                      `json:"tracing"`
}

type discussionTracingResponse struct {
	Tracing string `json:"tracing"`
}

type discussionErrorResponse struct {
	Error   string `json:"error"`
	Tracing string `json:"tracing,omitempty"`
}

func (t *TicketsService) ServeDiscussionHTTP(w http.ResponseWriter, r *http.Request) bool {
	if t == nil || r == nil {
		return false
	}
	parts := splitPath(r.URL.Path)
	if len(parts) < 5 || parts[0] != "api" || parts[1] != "tickets" || parts[3] != "messages" {
		return false
	}

	switch {
	case len(parts) == 5 && parts[4] == "list":
		if r.Method != http.MethodGet {
			writeDiscussionMethodNotAllowed(w, http.MethodGet)
			return true
		}
		t.handleDiscussionList(w, r, parts[2], false)
		return true
	case len(parts) == 6 && parts[4] == "list" && parts[5] == "all":
		if r.Method != http.MethodGet {
			writeDiscussionMethodNotAllowed(w, http.MethodGet)
			return true
		}
		t.handleDiscussionList(w, r, parts[2], true)
		return true
	case len(parts) == 5 && isInt64(parts[4]):
		switch r.Method {
		case http.MethodPatch, http.MethodPut:
			t.handleDiscussionEdit(w, r, parts[2], parts[4])
			return true
		case http.MethodDelete:
			t.handleDiscussionDelete(w, r, parts[2], parts[4])
			return true
		default:
			writeDiscussionMethodNotAllowed(w, http.MethodPatch, http.MethodPut, http.MethodDelete)
			return true
		}
	default:
		return false
	}
}

func (t *TicketsService) handleDiscussionList(w http.ResponseWriter, r *http.Request, rawTicketID string, includeDeleted bool) {
	id, err := parseDiscussionTicketID(rawTicketID)
	if err != nil {
		writeDiscussionError(w, r.Context(), apperrors.InvalidArguments.AddErrDetails("id is not correct"))
		return
	}
	token := discussionToken(r.URL.Query().Get("token"))
	ctx := withIncomingHTTPMetadata(r.Context(), r)
	list, err := t.DiscussionMessages(ctx, id, token, includeDeleted)
	if err != nil {
		writeDiscussionError(w, ctx, err)
		return
	}
	protoList := list.ToProto()
	t.hydrateMessageAuthors(ctx, protoList)
	payload := make([]discussionMessageResponse, 0, len(list))
	for index, message := range list {
		var author *userpb.UserPublic
		if index < len(protoList) {
			author = protoList[index].GetAuthor()
		}
		item := discussionMessageResponse{
			ID:      strconv.FormatInt(int64(message.ID), 10),
			Message: message.Content,
			Content: message.Content,
			Author:  author,
			Deleted: message.DeletedAt != nil,
		}
		if !message.At.IsZero() {
			at := message.At
			item.At = &at
		}
		if message.EditedAt != nil {
			item.EditedAt = message.EditedAt
		}
		if message.DeletedAt != nil {
			item.DeletedAt = message.DeletedAt
		}
		if message.DeletedByUID != nil {
			deletedBy := *message.DeletedByUID
			item.DeletedBy = &deletedBy
		}
		payload = append(payload, item)
	}
	writeDiscussionJSON(w, http.StatusOK, discussionListResponse{
		List:    payload,
		Tracing: TraceIDOrNew(ctx),
	})
}

func (t *TicketsService) handleDiscussionEdit(w http.ResponseWriter, r *http.Request, rawTicketID string, rawMessageID string) {
	id, messageID, req, err := parseDiscussionMutationRequest(r, rawTicketID, rawMessageID)
	if err != nil {
		writeDiscussionError(w, r.Context(), err)
		return
	}
	ctx := withIncomingHTTPMetadata(r.Context(), r)
	if err := t.DiscussionEditMessage(ctx, id, messageID, discussionToken(req.Token), req.Content); err != nil {
		writeDiscussionError(w, ctx, err)
		return
	}
	writeDiscussionJSON(w, http.StatusOK, discussionTracingResponse{Tracing: TraceIDOrNew(ctx)})
}

func (t *TicketsService) handleDiscussionDelete(w http.ResponseWriter, r *http.Request, rawTicketID string, rawMessageID string) {
	id, messageID, req, err := parseDiscussionMutationRequest(r, rawTicketID, rawMessageID)
	if err != nil {
		writeDiscussionError(w, r.Context(), err)
		return
	}
	token := discussionToken(req.Token)
	if token == nil {
		token = discussionToken(r.URL.Query().Get("token"))
	}
	ctx := withIncomingHTTPMetadata(r.Context(), r)
	if err := t.DiscussionDeleteMessage(ctx, id, messageID, token); err != nil {
		writeDiscussionError(w, ctx, err)
		return
	}
	writeDiscussionJSON(w, http.StatusOK, discussionTracingResponse{Tracing: TraceIDOrNew(ctx)})
}

func parseDiscussionMutationRequest(r *http.Request, rawTicketID string, rawMessageID string) (uuid.UUID, int64, discussionMutationRequest, error) {
	var req discussionMutationRequest
	id, err := parseDiscussionTicketID(rawTicketID)
	if err != nil {
		return uuid.UUID{}, 0, req, apperrors.InvalidArguments.AddErrDetails("id is not correct")
	}
	messageID, err := strconv.ParseInt(strings.TrimSpace(rawMessageID), 10, 64)
	if err != nil || messageID <= 0 {
		return uuid.UUID{}, 0, req, apperrors.InvalidArguments.AddErrDetails("message id is not correct")
	}
	decoded, err := decodeDiscussionBody(r)
	if err != nil {
		return uuid.UUID{}, 0, req, apperrors.InvalidArguments.AddErrDetails("request body is invalid")
	}
	return id, messageID, decoded, nil
}

func parseDiscussionTicketID(raw string) (uuid.UUID, error) {
	decoded, err := url.PathUnescape(strings.TrimSpace(raw))
	if err != nil {
		return uuid.UUID{}, err
	}
	return uuid.Parse(decoded)
}

func decodeDiscussionBody(r *http.Request) (discussionMutationRequest, error) {
	var req discussionMutationRequest
	if r == nil || r.Body == nil {
		return req, nil
	}
	defer func() {
		_ = r.Body.Close()
	}()
	data := io.LimitReader(r.Body, 1<<20)
	decoder := json.NewDecoder(data)
	if err := decoder.Decode(&req); err != nil {
		if errors.Is(err, io.EOF) {
			return discussionMutationRequest{}, nil
		}
		return discussionMutationRequest{}, err
	}
	return req, nil
}

func discussionToken(raw string) *string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	return &value
}

func splitPath(path string) []string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return nil
	}
	return strings.Split(trimmed, "/")
}

func isInt64(value string) bool {
	_, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	return err == nil
}

func withIncomingHTTPMetadata(ctx context.Context, r *http.Request) context.Context {
	if r == nil {
		return ctx
	}
	md := metadata.MD{}
	for key, values := range r.Header {
		lower := strings.ToLower(strings.TrimSpace(key))
		if lower == "" {
			continue
		}
		for _, value := range values {
			md.Append(lower, value)
		}
	}
	return metadata.NewIncomingContext(ctx, md)
}

func writeDiscussionMethodNotAllowed(w http.ResponseWriter, methods ...string) {
	if len(methods) > 0 {
		w.Header().Set("Allow", strings.Join(methods, ", "))
	}
	writeDiscussionJSON(w, http.StatusMethodNotAllowed, discussionErrorResponse{Error: "method not allowed"})
}

func writeDiscussionError(w http.ResponseWriter, ctx context.Context, err error) {
	status := discussionHTTPStatus(err)
	writeDiscussionJSON(w, status, discussionErrorResponse{
		Error:   err.Error(),
		Tracing: TraceIDOrNew(ctx),
	})
}

func discussionHTTPStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var appErr apperrors.ErrorST
	if !errors.As(err, &appErr) {
		return http.StatusInternalServerError
	}
	switch appErr.GRPCStatus().Code() {
	case codes.InvalidArgument:
		return http.StatusBadRequest
	case codes.Unauthenticated:
		return http.StatusUnauthorized
	case codes.PermissionDenied:
		return http.StatusForbidden
	case codes.NotFound:
		return http.StatusNotFound
	case codes.AlreadyExists:
		return http.StatusConflict
	case codes.Unimplemented:
		return http.StatusNotImplemented
	case codes.Unavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func writeDiscussionJSON(w http.ResponseWriter, status int, payload any) {
	if w == nil {
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	encoder := json.NewEncoder(w)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(payload); err != nil {
		http.Error(w, `{"error":"failed to encode response"}`, http.StatusInternalServerError)
	}
}
