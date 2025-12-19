package user

import (
	userinfo "ascendant/backend/internal/app/info/user"
	modifier "ascendant/backend/internal/app/modifier/user"
	"ascendant/backend/internal/infra/http/send"
	apperrors "ascendant/backend/internal/shared/errors"
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	info     *userinfo.Service
	modifier *modifier.Service
}

func New(infoService *userinfo.Service, modifierService *modifier.Service) *Handler {
	return &Handler{
		info:     infoService,
		modifier: modifierService,
	}
}

func (h *Handler) GetByID(c *gin.Context) {
	id, err := parseIDParam(c)
	if err != nil {
		send.Error(c, http.StatusBadRequest, err)
		return
	}

	u, err := h.info.GetByID(c.Request.Context(), id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	send.OK(c, u)
}

type updateNameRequest struct {
	Name string `json:"name"`
}

func (h *Handler) UpdateName(c *gin.Context) {
	id, err := parseIDParam(c)
	if err != nil {
		send.Error(c, http.StatusBadRequest, err)
		return
	}

	var req updateNameRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		send.Error(c, http.StatusBadRequest, err)
		return
	}

	u, err := h.modifier.UpdateName(c.Request.Context(), id, req.Name)
	if err != nil {
		h.handleError(c, err)
		return
	}

	send.OK(c, u)
}

func (h *Handler) handleError(c *gin.Context, err error) {
	if err == nil {
		send.Error(c, http.StatusInternalServerError, err)
		return
	}

	if appErr, ok := err.(apperrors.Error); ok {
		send.Error(c, statusForCode(appErr.Code), appErr)
		return
	}

	if appErr, ok := err.(*apperrors.Error); ok {
		send.Error(c, statusForCode(appErr.Code), appErr)
		return
	}

	if errors.Is(err, sql.ErrNoRows) {
		send.Error(c, http.StatusNotFound, err)
		return
	}

	send.Error(c, http.StatusInternalServerError, err)
}

func statusForCode(code string) int {
	switch code {
	case "InvalidUserID", "InvalidName":
		return http.StatusBadRequest
	case "UserNotFound":
		return http.StatusNotFound
	default:
		return http.StatusBadRequest
	}
}

func parseIDParam(c *gin.Context) (uint, error) {
	raw := c.Param("id")
	id, err := strconv.ParseUint(raw, 10, 0)
	if err != nil {
		return 0, err
	}
	return uint(id), nil
}
