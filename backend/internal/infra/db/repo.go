package db

import (
	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/domain/user"
	"ascendant/backend/internal/infra/logger"
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

type UserRepository struct {
	DB *sql.DB
}

type LoggerRepository struct {
	DB *sql.DB
}

var _ user.Repository = (*UserRepository)(nil)

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{DB: db}
}
func NewLoggerRepository(db *sql.DB) *LoggerRepository {
	return &LoggerRepository{DB: db}
}

func (u *UserRepository) GetUID(ctx context.Context, name string) (uint, error) {
	row := u.DB.QueryRowContext(ctx, "SELECT u.uid FROM users u WHERE u.username = $1", name)
	if err := row.Err(); err != nil {
		return 0, err
	}
	var uid uint
	if err := row.Scan(&uid); err != nil {
		return 0, err
	}
	return uid, nil
}

func (u *UserRepository) GetUsername(ctx context.Context, uid uint) (string, error) {
    row := u.DB.QueryRowContext(ctx, "SELECT u.username FROM users u WHERE u.uid = $1", uid)
    if err := row.Err(); err != nil {
        return "", err
    }
    var username string
    if err := row.Scan(&username); err != nil {
        return "", err
    }
    return username, nil
}

func (u *UserRepository) GetEmail(ctx context.Context, uid uint) (*user.Email, error) {
	row := u.DB.QueryRowContext(ctx, "SELECT (u.email).address, (u.email).verified FROM users u WHERE u.uid = $1", uid)
	if err := row.Err(); err != nil {
		return nil, err
	}
	var email user.Email
	if err := row.Scan(&email.Address, &email.Verified); err != nil {
		return nil, err
	}
	return &email, nil
}

func (u *UserRepository) GetRank(ctx context.Context, uid uint) (*rank.Rank, error) {
    row := u.DB.QueryRowContext(ctx, "SELECT (u.rank).name, (u.rank).expires FROM users u WHERE u.uid = $1", uid)
    if err := row.Err(); err != nil {
        return nil, err
    }
    var r rank.Rank
    var expires sql.NullTime
    if err := row.Scan(&r.Name, &expires); err != nil {
        return nil, err
    }
    if expires.Valid {
        r.Expires = &expires.Time
    }
    return &r, nil
}

func (u *UserRepository) GetJoinedAT(ctx context.Context, uid uint) (*time.Time, error) {
	row := u.DB.QueryRowContext(ctx, "SELECT u.joined FROM users u WHERE u.uid = $1", uid)
	if err := row.Err(); err != nil {
		return nil, err
	}
	var t time.Time
	if err := row.Scan(&t); err != nil {
		return nil, err
	}
	return &t, nil
}

func (u *UserRepository) GetSettings(ctx context.Context, uid uint) (*user.Settings, error) {
    rowMain := u.DB.QueryRowContext(ctx,
        "SELECT u.settings.session_live_time, u.settings.password, u.settings.display_name FROM users u WHERE u.uid = $1",
        uid)
    if err := rowMain.Err(); err != nil {
        return nil, err
    }
    var s user.Settings
    var displayName sql.NullString
    if err := rowMain.Scan(&s.SessionLiveTime, &s.Password, &displayName); err != nil {
        return nil, err
    }
    if displayName.Valid {
        s.DisplayName = &displayName.String
    }
	var a user.Avatar
	row := u.DB.QueryRowContext(ctx, " SELECT((u.settings).avatar).content_type, ((u.settings).avatar).data, ((u.settings).avatar).width, ((u.settings).avatar).height, ((u.settings).avatar).size_bytes, ((u.settings).avatar).updated FROM users u WHERE u.uid = $1", uid)
	if err := row.Err(); err != nil {
		return nil, err
	}
	if err := row.Scan(&a.ContentType, &a.Data, &a.Width, &a.Height, &a.SizeBytes, &a.Updated); err != nil {
		return nil, err
	}
	s.Avatar = a
	return &s, nil
}

func (u *UserRepository) GetUserByUID(ctx context.Context, uid uint) (*user.User, error) {
	var us user.User
	us.UID = uid
	if exists, err := u.IsExistsByUID(ctx, uid); err != nil || !exists {
		return nil, err
	}
	var err error
	us.Username, err = u.GetUsername(ctx, uid)
	if err != nil {
		return nil, err
	}
	at, err := u.GetJoinedAT(ctx, uid)
	if err != nil {
		return nil, err
	}
	if at == nil {
		return nil, errors.New("joined at pointer is null")
	}
	us.Joined = *at
	us.Email, err = u.GetEmail(ctx, uid)
	if err != nil {
		return nil, err
	}
	us.Rank, err = u.GetRank(ctx, uid)
	if err != nil {
		return nil, err
	}
	us.Settings, err = u.GetSettings(ctx, uid)
	if err != nil {
		return nil, err
	}
	return &us, nil
}

func (u *UserRepository) GetUserByUsername(ctx context.Context, username string) (*user.User, error) {
	uid, err := u.GetUID(ctx, username)
	if err != nil {
		return nil, err
	}
	return u.GetUserByUID(ctx, uid)
}

func (u *UserRepository) IsExists(ctx context.Context, user user.User) (bool, error) {
	var exists bool
	var emailAddress string
	if user.Email != nil {
		emailAddress = user.Email.Address
	}
	err := u.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM users u WHERE u.username = $1 OR (u.email).address = $2 OR u.uid = $3)", user.Username, emailAddress, user.UID).Scan(&exists)
	if err != nil {
		return false, err
	}
	if !exists {
		return false, errors.New("user not found")
	}
	return exists, nil
}

func (u *UserRepository) IsExistsByUID(ctx context.Context, uid uint) (bool, error) {
	return u.IsExists(ctx, user.User{UID: uid})
}

func (u *UserRepository) Register(ctx context.Context, user user.User) error {
	exists, err := u.IsExists(ctx, user)
	if err != nil {
		return err
	}
	if exists {
		return errors.New("user already exists")
	}
	if _, err = u.DB.ExecContext(ctx, `
	INSERT INTO users (username, email, settings, rank, joined)
	VALUES (
		$1,
		ROW($2, false)::users_email_t,
		ROW(NULL, NULL, $3, 30)::user_settings_t,
		ROW('user', NULL)::users_rank_t,
		$4
	)`, user.Username, user.Email.Address, user.Settings.Password, time.Now()); err != nil {
		return err
	}

	return nil
}

func (u *UserRepository) Authorize(ctx context.Context, user user.User) error {
	return nil
}

func (l *LoggerRepository) Append(ctx context.Context, event logger.Event) error {
	if event.TraceID == "" {
		event.TraceID = "-"
	}
	if _, err := l.DB.ExecContext(ctx, "INSERT INTO events(event_type, level, message, actor_type, actor_id, trace_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7)", strings.ToLower(event.Type.String()), event.Level.String(), event.Message, event.Actor.Type.String(), event.Actor.ID, event.TraceID, event.Result.String()); err != nil {
		return err
	}
	return nil
}

func (l *LoggerRepository) GetList(ctx context.Context, limit uint, offset uint) ([]*logger.Event, error) {
	var events []*logger.Event
	var err error
	var rows *sql.Rows
	if limit > 0 {
		rows, err = l.DB.QueryContext(ctx, "SELECT * FROM events ORDER BY at LIMIT $1 OFFSET $2", limit, offset)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
	} else {
		rows, err = l.DB.QueryContext(ctx, "SELECT * FROM events ORDER BY at OFFSET $1", offset)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
	}
	for rows.Next() {
		var event logger.Event
		if err = rows.Scan(&event.ID, &event.At, &event.Type, &event.Level, &event.Message, &event.Actor.Type, &event.Actor.ID, &event.Result, &event.TraceID); err != nil {
			return nil, err
		}
		events = append(events, &event)
	}
	return events, nil
}
