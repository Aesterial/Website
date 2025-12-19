package memory

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/domain/user"
)

var (
	ErrUserNotFound       = errors.New("user not found")
	ErrUserExists         = errors.New("user already exists")
	ErrMissingIdentifier  = errors.New("missing user identifier")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidUser        = errors.New("invalid user")
)

type UserRepository struct {
	mu        sync.RWMutex
	nextUID   uint
	users     map[uint]user.User
	usernames map[string]uint
	emails    map[string]uint
}

var _ user.Repository = (*UserRepository)(nil)

func NewUserRepository() *UserRepository {
	return &UserRepository{
		nextUID:   1,
		users:     make(map[uint]user.User),
		usernames: make(map[string]uint),
		emails:    make(map[string]uint),
	}
}

func (r *UserRepository) GetUID(ctx context.Context, username string) (uint, error) {
	if err := ctx.Err(); err != nil {
		return 0, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	uid, ok := r.usernames[username]
	if !ok {
		return 0, ErrUserNotFound
	}
	return uid, nil
}

func (r *UserRepository) GetUsername(ctx context.Context, uid uint) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return "", ErrUserNotFound
	}
	return u.Username, nil
}

func (r *UserRepository) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return nil, ErrUserNotFound
	}
	return cloneEmail(u.Email), nil
}

func (r *UserRepository) GetRank(ctx context.Context, uid uint) (*rank.Rank, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return nil, ErrUserNotFound
	}
	return cloneRank(u.Rank), nil
}

func (r *UserRepository) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return nil, ErrUserNotFound
	}
	if u.Joined.IsZero() {
		return nil, nil
	}
	joined := u.Joined
	return &joined, nil
}

func (r *UserRepository) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return nil, ErrUserNotFound
	}
	return cloneSettings(u.Settings), nil
}

func (r *UserRepository) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	u, ok := r.users[uid]
	if !ok {
		return nil, ErrUserNotFound
	}
	clone := cloneUser(u)
	return &clone, nil
}

func (r *UserRepository) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	uid, err := r.GetUID(ctx, username)
	if err != nil {
		return nil, err
	}
	return r.GetUserByUID(ctx, uid)
}

func (r *UserRepository) IsExists(ctx context.Context, u user.User) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if !hasIdentifier(u) {
		return false, ErrMissingIdentifier
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.lookupUIDLocked(u)
	return ok, nil
}

func (r *UserRepository) Register(ctx context.Context, u user.User) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := validateNewUser(u); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.usernames[u.Username]; ok {
		return ErrUserExists
	}
	if u.Email != nil {
		if _, ok := r.emails[u.Email.Address]; ok {
			return ErrUserExists
		}
	}
	if u.Joined.IsZero() {
		u.Joined = time.Now()
	}
	if u.UID == 0 {
		u.UID = r.nextUID
		r.nextUID++
	} else if _, ok := r.users[u.UID]; ok {
		return ErrUserExists
	} else if u.UID >= r.nextUID {
		r.nextUID = u.UID + 1
	}
	clone := cloneUser(u)
	r.users[clone.UID] = clone
	r.usernames[clone.Username] = clone.UID
	if clone.Email != nil && clone.Email.Address != "" {
		r.emails[clone.Email.Address] = clone.UID
	}
	return nil
}

func (r *UserRepository) Authorize(ctx context.Context, u user.User) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if !hasIdentifier(u) {
		return ErrMissingIdentifier
	}
	if u.Settings == nil || u.Settings.Password == "" {
		return ErrInvalidCredentials
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	uid, ok := r.lookupUIDLocked(u)
	if !ok {
		return ErrUserNotFound
	}
	stored := r.users[uid]
	if stored.Settings == nil || stored.Settings.Password != u.Settings.Password {
		return ErrInvalidCredentials
	}
	return nil
}

func (r *UserRepository) lookupUIDLocked(u user.User) (uint, bool) {
	if u.UID != 0 {
		if _, ok := r.users[u.UID]; ok {
			return u.UID, true
		}
	}
	if u.Username != "" {
		if uid, ok := r.usernames[u.Username]; ok {
			return uid, true
		}
	}
	if u.Email != nil && u.Email.Address != "" {
		if uid, ok := r.emails[u.Email.Address]; ok {
			return uid, true
		}
	}
	return 0, false
}

func hasIdentifier(u user.User) bool {
	return u.UID != 0 || u.Username != "" || (u.Email != nil && u.Email.Address != "")
}

func validateNewUser(u user.User) error {
	if strings.TrimSpace(u.Username) == "" {
		return ErrInvalidUser
	}
	if u.Email == nil || strings.TrimSpace(u.Email.Address) == "" {
		return ErrInvalidUser
	}
	if u.Settings == nil || strings.TrimSpace(u.Settings.Password) == "" {
		return ErrInvalidUser
	}
	return nil
}

func cloneUser(u user.User) user.User {
	u.Email = cloneEmail(u.Email)
	u.Settings = cloneSettings(u.Settings)
	u.Rank = cloneRank(u.Rank)
	return u
}

func cloneEmail(e *user.Email) *user.Email {
	if e == nil {
		return nil
	}
	clone := *e
	return &clone
}

func cloneSettings(s *user.Settings) *user.Settings {
	if s == nil {
		return nil
	}
	clone := *s
	if s.Avatar.Data != nil {
		clone.Avatar.Data = append([]byte(nil), s.Avatar.Data...)
	}
	return &clone
}

func cloneRank(r *rank.Rank) *rank.Rank {
	if r == nil {
		return nil
	}
	clone := *r
	return &clone
}
