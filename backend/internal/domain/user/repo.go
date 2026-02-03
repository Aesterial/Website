package user

import (
	"Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/rank"
	"Aesterial/backend/internal/gen/user/v1"
	"context"
	"time"
)

type Repository interface {
	GetList(ctx context.Context) ([]*user.UserPublic, error)
	GetUID(ctx context.Context, username string) (uint, error)
	GetUsername(ctx context.Context, uid uint) (string, error)
	GetEmail(ctx context.Context, uid uint) (*Email, error)
	GetRank(ctx context.Context, uid uint) (*rank.UserRank, error)
	GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error)
	GetSettings(ctx context.Context, uid uint) (*Settings, error)
	GetUserByUID(ctx context.Context, uid uint) (*User, error)
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	GetUserSessionLiveTime(ctx context.Context, uid uint) (*SessionTime, error)
	GetUserLastActive(ctx context.Context, uid uint) (*time.Time, error)
	GetAvatar(ctx context.Context, uid uint) (*Avatar, error)
	UpdateDisplayName(ctx context.Context, uid uint, displayName string) error
	SetEmailVerifiedByAddress(ctx context.Context, email string, verified bool) error
	UpdatePasswordByEmail(ctx context.Context, email string, passwordHash string) error
	IsExists(ctx context.Context, user User) (bool, error)
	IsBanned(ctx context.Context, uid uint) (bool, *BanInfo, error)
	Ban(ctx context.Context, info BanInfo) error
	UnBan(ctx context.Context, uid uint) error
	BanInfo(ctx context.Context, uid uint) (*BanInfo, error)
	AddAvatar(ctx context.Context, uid uint, avatar Avatar) error
	DeleteAvatar(ctx context.Context, uid uint) error
	DeleteProfile(ctx context.Context, uid uint) error
	HasPerm(ctx context.Context, uid uint, perm permissions.Permission) (bool, error)
	HasAllPerms(ctx context.Context, uid uint, perms ...permissions.Permission) (bool, error)
	Perms(ctx context.Context, uid uint) (*permissions.Permissions, error)
	ChangePerms(ctx context.Context, uid uint, perm permissions.Permission, state bool) error
	SetRank(ctx context.Context, uid uint, rank string, expires *time.Time) error
	SetCodeUsed(ctx context.Context, hash string) error
	GetRecoveryCodes(ctx context.Context, uid uint) ([]string, error)
	CascadeRecoveryCodes(ctx context.Context, uid uint, codes []string) error
	AppendRecoveryCodes(ctx context.Context, uid uint, cds []string) error
	SetConfirmed(ctx context.Context, uid uint) error
	SetPendingTOTP(ctx context.Context, uid uint, pending string) error
	GetPendingTOTP(ctx context.Context, uid uint) (*string, error) 
	IsTOTPEnabled(ctx context.Context, uid uint) (bool, error)
	ResetTOTP(ctx context.Context, uid uint) error
	IsValidRecovery(ctx context.Context, uid uint, code string) (bool, error)
	IsTOTPending(ctx context.Context, uid uint) (bool, error)
	GetTOTPLastStep(ctx context.Context, uid uint) (*int64, error)
	GetTOTPSecret(ctx context.Context, uid uint) (string, error)
	SetTOTPLastStep(ctx context.Context, uid uint, step int64) error
	CanEdit(ctx context.Context, user uint, target uint) (bool, error)
}
