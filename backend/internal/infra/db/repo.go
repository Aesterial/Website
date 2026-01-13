package db

import (
	"ascendant/backend/internal/domain/login"
	"ascendant/backend/internal/domain/maintenance"
	"ascendant/backend/internal/domain/permissions"
	projectdomain "ascendant/backend/internal/domain/projects"
	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/domain/sessions"
	"ascendant/backend/internal/domain/statistics"
	"ascendant/backend/internal/domain/submissions"
	"ascendant/backend/internal/domain/tickets"
	"ascendant/backend/internal/domain/verification"
	userpb "ascendant/backend/internal/gen/user/v1"
	"fmt"

	"ascendant/backend/internal/domain/user"
	statpb "ascendant/backend/internal/gen/statistics/v1"
	"ascendant/backend/internal/infra/logger"
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type UserRepository struct {
	DB *sql.DB
}
type LoggerRepository struct {
	DB *sql.DB
}
type LoginRepository struct {
	DB *sql.DB
}

type SessionsRepository struct {
	DB *sql.DB
}

type PermissionsRepository struct {
	DB *sql.DB
}

type ProjectsRepository struct {
	DB *sql.DB
}

type StatisticsRepository struct {
	DB *sql.DB
}

type SubmissionsRepository struct {
	DB *sql.DB
}

type VerificationRepository struct {
	DB *sql.DB
}

type MaintenanceRepository struct {
	DB *sql.DB
}

type TicketsRepository struct {
	DB *sql.DB
}

var _ user.Repository = (*UserRepository)(nil)

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{DB: db}
}
func NewLoggerRepository(db *sql.DB) *LoggerRepository {
	return &LoggerRepository{DB: db}
}
func NewLoginRepository(db *sql.DB) *LoginRepository {
	return &LoginRepository{DB: db}
}
func NewSessionsRepository(db *sql.DB) *SessionsRepository {
	return &SessionsRepository{DB: db}
}
func NewPermissionsRepository(db *sql.DB) *PermissionsRepository {
	return &PermissionsRepository{DB: db}
}
func NewStatisticsRepository(db *sql.DB) *StatisticsRepository {
	return &StatisticsRepository{DB: db}
}
func NewProjectsRepository(db *sql.DB) *ProjectsRepository {
	return &ProjectsRepository{DB: db}
}
func NewSubmissionRepository(db *sql.DB) *SubmissionsRepository {
	return &SubmissionsRepository{DB: db}
}
func NewVerificationRepository(db *sql.DB) *VerificationRepository {
	return &VerificationRepository{DB: db}
}
func NewMaintenanceRepository(db *sql.DB) *MaintenanceRepository {
	return &MaintenanceRepository{DB: db}
}
func NewTicketsRepository(db *sql.DB) *TicketsRepository {
	return &TicketsRepository{DB: db}
}

type compositeField struct {
	Value string
	Valid bool
}

func parseComposite(raw string) ([]compositeField, error) {
	if raw == "" {
		return nil, errors.New("composite value is empty")
	}
	if raw[0] != '(' || raw[len(raw)-1] != ')' {
		return nil, fmt.Errorf("invalid composite value: %q", raw)
	}
	raw = raw[1 : len(raw)-1]
	var fields []compositeField
	var buf strings.Builder
	inQuotes := false
	escape := false
	depth := 0
	fieldQuoted := false

	flush := func() {
		val := buf.String()
		if val == "" && !fieldQuoted {
			fields = append(fields, compositeField{Valid: false})
		} else {
			fields = append(fields, compositeField{Value: val, Valid: true})
		}
		buf.Reset()
		fieldQuoted = false
	}

	for i := 0; i < len(raw); i++ {
		ch := raw[i]
		if inQuotes {
			if escape {
				buf.WriteByte(ch)
				escape = false
				continue
			}
			if ch == '\\' {
				escape = true
				continue
			}
			if ch == '"' {
				inQuotes = false
				continue
			}
			buf.WriteByte(ch)
			continue
		}
		switch ch {
		case '"':
			inQuotes = true
			if depth == 0 {
				fieldQuoted = true
			}
		case '(':
			depth++
			buf.WriteByte(ch)
		case ')':
			if depth > 0 {
				depth--
			}
			buf.WriteByte(ch)
		case ',':
			if depth == 0 {
				flush()
			} else {
				buf.WriteByte(ch)
			}
		default:
			buf.WriteByte(ch)
		}
	}
	flush()
	return fields, nil
}

func parsePostgresBool(raw string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "t", "true", "1", "yes", "y":
		return true, nil
	case "f", "false", "0", "no", "n":
		return false, nil
	default:
		return false, fmt.Errorf("invalid bool value: %q", raw)
	}
}

func parsePostgresTime(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, errors.New("time value is empty")
	}
	layouts := []string{
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999Z07",
		"2006-01-02 15:04:05Z07",
		"2006-01-02T15:04:05.999999999Z07:00",
		"2006-01-02T15:04:05Z07:00",
		"2006-01-02T15:04:05.999999999Z07",
		"2006-01-02T15:04:05Z07",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported time format: %q", raw)
}

func parseRowsToUsers(ctx context.Context, rows *sql.Rows, getAvatar func(context.Context, uint) (*user.Avatar, error), isBanned func(context.Context, uint) (bool, *user.BanInfo, error)) (user.Users, error) {
	var usrs user.Users
	var err error
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var usr = user.User{Settings: &user.Settings{Avatar: &user.Avatar{}}, Rank: &rank.Rank{}, Email: &user.Email{}}
		switch len(cols) {
		case 7:
			var emailAddress sql.NullString
			var emailVerified sql.NullBool
			var rankName sql.NullString
			var rankExpires sql.NullTime
			if err := rows.Scan(&usr.UID, &usr.Username, &emailAddress, &emailVerified, &rankName, &rankExpires, &usr.Joined); err != nil {
				return nil, err
			}
			if emailAddress.Valid {
				usr.Email.Address = emailAddress.String
			}
			if emailVerified.Valid {
				usr.Email.Verified = emailVerified.Bool
			}
			if rankName.Valid {
				usr.Rank.Name = rankName.String
			}
			if rankExpires.Valid {
				usr.Rank.Expires = &rankExpires.Time
			}
		case 8:
			var emailRaw sql.NullString
			var settingsRaw sql.NullString
			var rankRaw sql.NullString
			var permissionsRaw sql.NullString
			var password sql.NullString
			if err := rows.Scan(&usr.UID, &usr.Username, &emailRaw, &settingsRaw, &rankRaw, &permissionsRaw, &usr.Joined, &password); err != nil {
				return nil, err
			}
			password.String = ""

			if emailRaw.Valid {
				fields, err := parseComposite(emailRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) < 2 {
					return nil, fmt.Errorf("email composite has %d fields", len(fields))
				}
				if fields[0].Valid {
					usr.Email.Address = fields[0].Value
				}
				if fields[1].Valid {
					verified, err := parsePostgresBool(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Email.Verified = verified
				}
			}

			if settingsRaw.Valid {
				fields, err := parseComposite(settingsRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					displayName := strings.TrimSpace(fields[0].Value)
					if displayName != "" {
						usr.Settings.DisplayName = &displayName
					}
				}
				if len(fields) >= 3 && fields[2].Valid && fields[2].Value != "" {
					liveTime, err := strconv.Atoi(fields[2].Value)
					if err != nil {
						return nil, err
					}
					usr.Settings.SessionLiveTime = liveTime
				}
			}

			if rankRaw.Valid {
				fields, err := parseComposite(rankRaw.String)
				if err != nil {
					return nil, err
				}
				if len(fields) >= 1 && fields[0].Valid {
					usr.Rank.Name = fields[0].Value
				}
				if len(fields) >= 2 && fields[1].Valid && fields[1].Value != "" {
					expiresAt, err := parsePostgresTime(fields[1].Value)
					if err != nil {
						return nil, err
					}
					usr.Rank.Expires = &expiresAt
				}
			}
			_ = permissionsRaw
		default:
			return nil, fmt.Errorf("unexpected users columns count: %d", len(cols))
		}
		usr.Settings.Avatar, err = getAvatar(ctx, usr.UID)
		if err != nil {
			return nil, err
		}
		usr.Banned, _, err = isBanned(ctx, usr.UID)
		if err != nil {
			return nil, err
		}
		usrs = append(usrs, &usr)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return usrs, nil
}

const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

func generateString(n int) (string, error) {
	if n <= 0 {
		return "", nil
	}

	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("rand.Read: %w", err)
	}

	out := make([]byte, n)
	for i := range n {
		out[i] = letters[int(b[i])%len(letters)]
	}
	return string(out), nil
}

func (u *UserRepository) GetList(ctx context.Context) ([]*userpb.UserPublic, error) {
	rows, err := u.DB.QueryContext(ctx, "SELECT u.uid, u.username, (u.email).address, (u.email).verified, (u.rank).name, (u.rank).expires, u.joined FROM users u ORDER BY u.joined")
	if err != nil {
		return nil, err
	}
	usrs, err := parseRowsToUsers(ctx, rows, u.GetAvatar, u.IsBanned)
	if err != nil {
		return nil, err
	}
	return usrs.ToPublic(), nil
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
	var err error
	rowMain := u.DB.QueryRowContext(ctx,
		"SELECT (u.settings).session_live_time, (u.settings).display_name FROM users u WHERE u.uid = $1",
		uid)
	if err = rowMain.Err(); err != nil {
		return nil, err
	}
	var s user.Settings
	var displayName sql.NullString
	if err = rowMain.Scan(&s.SessionLiveTime, &displayName); err != nil {
		return nil, err
	}
	if displayName.Valid {
		if displayName.String != "" {
			s.DisplayName = &displayName.String
		}
	}
	s.Avatar, err = u.GetAvatar(ctx, uid)
	if err != nil {
		return nil, err
	}
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

func (u *UserRepository) GetUserSessionLiveTime(ctx context.Context, uid uint) (*user.SessionTime, error) {
	if uid == 0 {
		return nil, errors.New("uid is zero")
	}
	var liveTime int
	if err := u.DB.QueryRowContext(ctx, "SELECT (u.settings).session_live_time FROM users u WHERE u.uid = $1", uid).Scan(&liveTime); err != nil {
		return nil, err
	}
	var sessionTime user.SessionTime
	sessionTime.Text = strconv.Itoa(liveTime)
	sessionTime.Duration = time.Duration(liveTime) * 24 * time.Hour
	return &sessionTime, nil
}

func (u *UserRepository) GetAvatar(ctx context.Context, uid uint) (*user.Avatar, error) {
	if uid == 0 {
		return nil, errors.New("uid is zero")
	}
	var avatar user.Avatar
	var record struct {
		key         sql.NullString
		contentType sql.NullString
		sizeBytes   sql.NullInt64
		updatedAt   sql.NullTime
	}
	if err := u.DB.QueryRowContext(ctx, `
		SELECT a.object_key, a.content_type, a.size_bytes, a.updated_at
		FROM user_avatars a
		WHERE a.user_id = $1
	`, uid).Scan(&record.key, &record.contentType, &record.sizeBytes, &record.updatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if !record.key.Valid || strings.TrimSpace(record.key.String) == "" {
		return nil, nil
	}
	avatar.Key = record.key.String
	avatar.ContentType = record.contentType.String
	if record.sizeBytes.Valid {
		avatar.SizeBytes = int(record.sizeBytes.Int64)
	}
	if record.updatedAt.Valid {
		avatar.Updated = record.updatedAt.Time
	}
	return &avatar, nil
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

func (u *UserRepository) UpdateDisplayName(ctx context.Context, uid uint, displayName string) error {
	if uid == 0 {
		return errors.New("uid is zero")
	}
	res, err := u.DB.ExecContext(ctx, `
		UPDATE users u
		SET settings = ROW($1, (u.settings).avatar, (u.settings).session_live_time)::user_settings_t
		WHERE u.uid = $2`, displayName, uid)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("user not found")
	}
	return nil
}

func (u *UserRepository) IsBanned(ctx context.Context, uid uint) (bool, *user.BanInfo, error) {
	if uid == 0 {
		return false, nil, errors.New("uid is zero")
	}
	var found bool
	err := u.DB.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM bans b WHERE b.target = $1)
	`, uid).Scan(&found)
	if err != nil {
		return false, nil, err
	}
	if !found {
		return false, nil, nil
	}
	info, err := u.BanInfo(ctx, uid)
	if err != nil {
		return false, nil, err
	}
	return found, info, nil
}

func (u *UserRepository) Ban(ctx context.Context, info user.BanInfo) error {
	if info.Empty() {
		return errors.New("invalid argument")
	}
	var expr *time.Time = nil
	if info.Expire.IsZero() {
		expr = &info.Expire
	}
	_, err := u.DB.ExecContext(ctx, "INSERT INTO bans (executor, target, reason, expires) VALUES ($1, $2, $3, $4)", info.Executor, info.Target, info.Reason, expr)
	return err
}

func (u *UserRepository) UnBan(ctx context.Context, uid uint) error {
	if uid == 0 {
		return errors.New("uid is zero")
	}
	_, err := u.DB.ExecContext(ctx, "DELETE FROM bans b WHERE b.target = $1", uid)
	return err
}

func (u *UserRepository) BanInfo(ctx context.Context, uid uint) (*user.BanInfo, error) {
	if uid == 0 {
		return nil, errors.New("uid is zero")
	}
	var info user.BanInfo
	if err := u.DB.QueryRowContext(ctx, "SELECT b.id, b.executor, b.reason, b.at, b.expires FROM bans b WHERE b.target = $1", uid).Scan(&info.ID, &info.Executor, &info.Reason, &info.At, &info.Expires); err != nil {
		return nil, err
	}
	return &info, nil
}

func (u *UserRepository) AddAvatar(ctx context.Context, uid uint, avatar user.Avatar) error {
	if uid == 0 {
		return errors.New("uid is zero")
	}
	if strings.TrimSpace(avatar.Key) == "" {
		return errors.New("avatar key is empty")
	}
	_, err := u.DB.ExecContext(ctx, `
		INSERT INTO user_avatars (user_id, object_key, content_type, size_bytes, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (user_id)
		DO UPDATE SET
			object_key = excluded.object_key,
			content_type = excluded.content_type,
			size_bytes = excluded.size_bytes,
			updated_at = now()
	`, uid, avatar.Key, avatar.ContentType, avatar.SizeBytes)
	return err
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
		defer func(rows *sql.Rows) {
			err = rows.Close()
			if err != nil {
				logger.Error("Failed to close rows: "+err.Error(), "runtime.db.rows.close", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
				return
			}
		}(rows)
	} else {
		rows, err = l.DB.QueryContext(ctx, "SELECT * FROM events ORDER BY at OFFSET $1", offset)
		if err != nil {
			return nil, err
		}
		defer func(rows *sql.Rows) {
			err = rows.Close()
			if err != nil {
				logger.Error("Failed to close rows: "+err.Error(), "runtime.db.rows.close", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
				return
			}
		}(rows)
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

func (l *LoginRepository) Register(ctx context.Context, require login.RegisterRequire) (*uint, error) {
	if require.IsEmpty() {
		return nil, errors.New("some of params is empty")
	}
	var id uint
	err := l.DB.QueryRowContext(ctx, `
		INSERT INTO users (username, email, password)
		VALUES (
		$1,
		ROW($2, false)::users_email_t,
		$3) RETURNING uid`,
		require.Username, require.Email, require.Password).Scan(&id)
	if err != nil {
		return nil, err
	}
	return &id, nil
}

func (l *LoginRepository) Authorization(ctx context.Context, require login.AuthorizationRequire) (*uint, error) {
	if require.IsEmpty() {
		return nil, errors.New("some of params is empty")
	}
	var uid uint
	if err := l.DB.QueryRowContext(ctx, "SELECT u.uid FROM users u WHERE u.username = $1", require.Usermail).Scan(&uid); err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}
	if uid == 0 {
		if err := l.DB.QueryRowContext(ctx, "SELECT u.uid FROM users u WHERE (u.email).address = $1", require.Usermail).Scan(&uid); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return nil, errors.New("user not found")
			}
			return nil, err
		}
	}
	if uid == 0 {
		return nil, errors.New("user not found")
	}
	var password string
	if err := l.DB.QueryRowContext(ctx, "SELECT u.password FROM users u WHERE u.uid = $1", uid).Scan(&password); err != nil {
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(password), []byte(require.Password)); err != nil {
		return nil, err
	}
	return &uid, nil
}

func (l *LoginRepository) Logout(ctx context.Context, sessionID uuid.UUID) error {
	if sessionID == uuid.Nil {
		return errors.New("invalid session")
	}
	_, err := l.DB.ExecContext(ctx, "UPDATE sessions SET revoked = true WHERE id = $1", sessionID)
	return err
}

func (s *SessionsRepository) IsValid(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	var expires time.Time
	var revoked bool
	row := s.DB.QueryRowContext(ctx, "SELECT expires, revoked FROM sessions s WHERE s.id = $1", sessionID)
	if err := row.Scan(&expires, &revoked); err != nil {
		return false, err
	}
	return time.Now().Before(expires) && !revoked, nil
}

func (s *SessionsRepository) GetSession(ctx context.Context, sessionID uuid.UUID) (*sessions.Session, error) {
	var ses sessions.Session
	if err := s.DB.QueryRowContext(ctx, "SELECT * FROM sessions s WHERE s.id = $1", sessionID).Scan(&ses.ID, &ses.UID, &ses.Created, &ses.LastSeenAt, &ses.Expires, &ses.Revoked, &ses.MfaComplete, &ses.AgentHash); err != nil {
		return nil, err
	}
	return &ses, nil
}

func (s *SessionsRepository) GetSessions(ctx context.Context, uid uint) ([]*sessions.Session, error) {
	var sess []*sessions.Session
	rows, err := s.DB.QueryContext(ctx, "SELECT id FROM sessions s WHERE s.uid = $1", uid)
	if err != nil {
		return nil, err
	}
	defer func(rows *sql.Rows) {
		err = rows.Close()
		if err != nil {
			logger.Error("Failed to close rows: "+err.Error(), "runtime.db.rows.close", logger.EventActor{Type: logger.System, ID: 0}, logger.None)
			return
		}
	}(rows)
	for rows.Next() {
		var data *sessions.Session
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		data, err = s.GetSession(ctx, id)
		if err != nil {
			return nil, err
		}
		sess = append(sess, data)
	}
	return sess, nil
}

func (s *SessionsRepository) GetUID(ctx context.Context, sessionID uuid.UUID) (*uint, error) {
	var uid uint
	err := s.DB.QueryRowContext(ctx, "SELECT uid FROM sessions s WHERE s.id = $1", sessionID).Scan(&uid)
	return &uid, err
}

func (s *SessionsRepository) SetRevoked(ctx context.Context, sessionID uuid.UUID) error {
	if _, err := s.DB.ExecContext(ctx, "UPDATE sessions SET revoked = true WHERE id = $1", sessionID); err != nil {
		return err
	}
	return nil
}

func (s *SessionsRepository) AddSession(ctx context.Context, sessionID uuid.UUID, agentHash string, expires time.Time, uid uint) error {
	_, err := s.DB.ExecContext(ctx, "INSERT INTO sessions (id, uid, expires, user_agent_hash) VALUES ($1,$2, $3, $4)", sessionID, uid, expires, agentHash)
	return err
}

func (s *SessionsRepository) UpdateLastSeen(ctx context.Context, sessionID uuid.UUID) error {
	_, err := s.DB.ExecContext(ctx, "UPDATE sessions SET last_seen_at = $1 WHERE id = $2", time.Now(), sessionID)
	return err
}

func fetchPermissions(row *sql.Row) (*permissions.Permissions, error) {
	var perm permissions.Permissions
	if err := row.Scan(
		&perm.ViewOtherProfile,
		&perm.PatchOtherProfile,
		&perm.PatchSelfProfile,
		&perm.DeleteSelfProfile,
		&perm.BanProfile,
		&perm.UnBanProfile,

		&perm.CreateIdea,
		&perm.PatchSelfIdea,
		&perm.DeleteSelfIdea,
		&perm.PatchOtherIdea,
		&perm.DeleteOtherIdea,

		&perm.CreateComment,
		&perm.PatchSelfComment,
		&perm.DeleteSelfComment,
		&perm.DeleteOtherComment,

		&perm.UploadIdeaMediaSelf,
		&perm.DeleteIdeaMediaSelf,
		&perm.DeleteIdeaMediaOther,

		&perm.ModerateIdea,
		&perm.ModerateCommentHide,
		&perm.ModerateCommentUnhide,

		&perm.PatchIdeaStatusAdmin,
		&perm.ViewStatistics,
		&perm.ViewPermissions,
		&perm.ManagePermissions,
	); err != nil {
		return nil, err
	}
	return &perm, nil
}

func updateUserPermissions(DB *sql.DB, ctx context.Context, usr uint, perms *permissions.Permissions) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE users u
		SET permissions = ROW(
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23, $24, $25
		)::permissions_t
		WHERE u.uid = $26`,
		perms.ViewOtherProfile,
		perms.PatchOtherProfile,
		perms.PatchSelfProfile,
		perms.DeleteSelfProfile,
		perms.BanProfile,
		perms.UnBanProfile,
		perms.CreateIdea,
		perms.PatchSelfIdea,
		perms.DeleteSelfIdea,
		perms.PatchOtherIdea,
		perms.DeleteOtherIdea,
		perms.CreateComment,
		perms.PatchSelfComment,
		perms.DeleteSelfComment,
		perms.DeleteOtherComment,
		perms.UploadIdeaMediaSelf,
		perms.DeleteIdeaMediaSelf,
		perms.DeleteIdeaMediaOther,
		perms.ModerateIdea,
		perms.ModerateCommentHide,
		perms.ModerateCommentUnhide,
		perms.PatchIdeaStatusAdmin,
		perms.ViewStatistics,
		perms.ViewPermissions,
		perms.ManagePermissions,
		usr,
	)
	return err
}

func updateRankPermissions(DB *sql.DB, ctx context.Context, rank string, perms *permissions.Permissions) error {
	_, err := DB.ExecContext(ctx, `
		UPDATE ranks r
		SET permissions = ROW(
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23, $24, $25
		)::permissions_t
		WHERE r.name = $26`,
		perms.ViewOtherProfile,
		perms.PatchOtherProfile,
		perms.PatchSelfProfile,
		perms.DeleteSelfProfile,
		perms.BanProfile,
		perms.UnBanProfile,
		perms.CreateIdea,
		perms.PatchSelfIdea,
		perms.DeleteSelfIdea,
		perms.PatchOtherIdea,
		perms.DeleteOtherIdea,
		perms.CreateComment,
		perms.PatchSelfComment,
		perms.DeleteSelfComment,
		perms.DeleteOtherComment,
		perms.UploadIdeaMediaSelf,
		perms.DeleteIdeaMediaSelf,
		perms.DeleteIdeaMediaOther,
		perms.ModerateIdea,
		perms.ModerateCommentHide,
		perms.ModerateCommentUnhide,
		perms.PatchIdeaStatusAdmin,
		perms.ViewStatistics,
		perms.ViewPermissions,
		perms.ManagePermissions,
		rank,
	)
	return err
}

func (p *PermissionsRepository) GetForRank(ctx context.Context, rank string) (*permissions.Permissions, error) {
	row := p.DB.QueryRowContext(ctx, "SELECT (r.permissions).* FROM ranks r WHERE r.name = $1", rank)
	return fetchPermissions(row)
}

func (p *PermissionsRepository) GetForUser(ctx context.Context, uid uint) (*permissions.Permissions, error) {
	row := p.DB.QueryRowContext(ctx, "SELECT (u.permissions).* FROM users u WHERE u.uid = $1", uid)
	return fetchPermissions(row)
}

func (p *PermissionsRepository) Has(ctx context.Context, uid uint, need permissions.Permission) (bool, error) {
	perms, err := p.GetForUser(ctx, uid)
	if err != nil {
		return false, err
	}
	return perms.Has(need)
}

func (p *PermissionsRepository) HasAll(ctx context.Context, uid uint, need ...permissions.Permission) (bool, error) {
	perms, err := p.GetForUser(ctx, uid)
	if err != nil {
		return false, err
	}

	for _, n := range need {
		ok := perms.HasBool(n)
		if !ok {
			return false, nil
		}
	}
	return true, nil
}

func (p *PermissionsRepository) ChangeForUser(ctx context.Context, uid uint, need permissions.Permission, state bool) error {
	perms, err := p.GetForUser(ctx, uid)
	if err != nil {
		return err
	}
	if err = perms.Set(need, state); err != nil {
		return err
	}
	if err = updateUserPermissions(p.DB, ctx, uid, perms); err != nil {
		return err
	}
	return nil
}

func (p *PermissionsRepository) ChangeForRank(ctx context.Context, rank string, need permissions.Permission, state bool) error {
	perms, err := p.GetForRank(ctx, rank)
	if err != nil {
		return err
	}
	if err = perms.Set(need, state); err != nil {
		return err
	}
	if err = updateRankPermissions(p.DB, ctx, rank, perms); err != nil {
		return err
	}
	return nil
}
func (p *PermissionsRepository) SetForUser(ctx context.Context, uid uint, perms *permissions.Permissions) error {
	if perms == nil {
		return errors.New("permissions is nil")
	}
	return updateUserPermissions(p.DB, ctx, uid, perms)
}

func (p *PermissionsRepository) SetForRank(ctx context.Context, rank string, perms *permissions.Permissions) error {
	if perms == nil {
		return errors.New("permissions is nil")
	}
	return updateRankPermissions(p.DB, ctx, rank, perms)
}

func getAuthor(ctx context.Context, uid uint, db *sql.DB) (*user.User, error) {
	usr, err := NewUserRepository(db).GetUserByUID(ctx, uid)
	if err != nil {
		return nil, err
	}
	return usr, nil
}

func getProjectPhotos(ctx context.Context, projId uuid.UUID, db *sql.DB) (user.Avatars, error) {
	rows, err := db.QueryContext(ctx, "SELECT (p.info).content_type, (p.info).pic_id, (p.info).size_bytes, (p.info).updated FROM pictures p WHERE p.owner = $1 AND p.owner_type = 'project' ", projId.String())
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()
	avatars := make([]*user.Avatar, 0)
	for rows.Next() {
		var avatar user.Avatar
		if err := rows.Scan(&avatar.ContentType, &avatar.Key, &avatar.SizeBytes, &avatar.Updated); err != nil {
			return nil, err
		}
		avatars = append(avatars, &avatar)
	}
	return avatars, nil
}

func getWhoLikedProject(ctx context.Context, id uuid.UUID, db *sql.DB) (user.Users, error) {
	rows, err := db.QueryContext(ctx, "SELECT u.* FROM project_likes l JOIN users u ON u.uid = l.user_uid WHERE l.project_id = $1 ORDER BY l.created_at DESC OFFSET $2", id, 0)
	if err != nil {
		return nil, err
	}
	u := NewUserRepository(db)
	return parseRowsToUsers(ctx, rows, u.GetAvatar, u.IsBanned)
}

func getProject(ctx context.Context, id uuid.UUID, db *sql.DB) (*projectdomain.Project, error) {
	var project projectdomain.Project
	var err error
	var authorID uint
	if err = db.QueryRowContext(ctx, "SELECT p.id, p.author_uid, (p.info).title, (p.info).description, (p.info).category, ((p.info).location).city, ((p.info).location).street, ((p.info).location).house, p.likes_count, p.created_at, p.status FROM projects p WHERE p.id = $1", id).Scan(
		&project.ID, &authorID, &project.Info.Title, &project.Info.Description, &project.Info.Category, &project.Info.Location.City, &project.Info.Location.Street, &project.Info.Location.House, &project.Likes, &project.At, &project.Status); err != nil {
		return nil, err
	}
	project.Author, err = getAuthor(ctx, authorID, db)
	if err != nil {
		return nil, err
	}
	project.Info.Photos, err = getProjectPhotos(ctx, project.ID, db)
	if err != nil {
		return nil, err
	}
	if project.Likes > 0 {
		liked, err := getWhoLikedProject(ctx, project.ID, db)
		if err != nil {
			return nil, err
		}
		project.Liked = &liked
	}
	return &project, nil
}

func (p *ProjectsRepository) GetProject(ctx context.Context, id uuid.UUID) (*projectdomain.Project, error) {
	return getProject(ctx, id, p.DB)
}

func (p *ProjectsRepository) GetProjectsByUID(ctx context.Context, uid int) ([]*projectdomain.Project, error) {
	var projects []*projectdomain.Project
	rows, err := p.DB.QueryContext(ctx, "SELECT p.id FROM projects p WHERE p.author_uid = $1", uid)
	if err != nil {
		return nil, err
	}
	defer func(rows *sql.Rows) {
		err := rows.Close()
		if err != nil {
			logger.Error("failed to close rows: "+err.Error(), "system.db.rows.close", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		}
	}(rows)
	for rows.Next() {
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		project, err := p.GetProject(ctx, id)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, nil
}

func (p *ProjectsRepository) CreateProject(ctx context.Context, info projectdomain.Project) error {
	var projectId uuid.UUID
	if err := p.DB.QueryRowContext(ctx, "INSERT INTO projects (author_uid, info) VALUES ($1, ROW($2, $3, $4::project_categories, ROW($5, $6, $7)::project_location_t)::project_info_t) RETURNING id", info.Author.UID, info.Info.Title, info.Info.Description, info.Info.Category, info.Info.Location.City, info.Info.Location.Street, info.Info.Location.House).Scan(&projectId); err != nil {
		return err
	}
	//stmt, err := p.DB.PrepareContext(ctx, "INSERT INTO pictures (owner, owner_type, info) VALUES ($1, $2, ROW($3, $4, $5, $6, $7)::picture_t)")
	//if err != nil {
	//	return err
	//}
	//defer stmt.Close()
	//for _, pic := range info.Info.Photos {
	//	if pic == nil {
	//		continue
	//	}
	//	if _, err = stmt.Exec(projectId.String(), "project", pic.ContentType, pic.Data, pic.Width, pic.Height, pic.SizeBytes); err != nil {
	//		logger.Debug("Failed to save project photo: "+err.Error(), "projects.photos.save")
	//		continue
	//	}
	//}
	if _, err := p.DB.ExecContext(ctx, "INSERT INTO submissions (project_id) VALUES ($1)", projectId); err != nil {
		return err
	}
	return nil
}

func (p *ProjectsRepository) GetCategories(ctx context.Context) ([]string, error) {
	var enumName = "project_categories"
	var result []string
	rows, err := p.DB.QueryContext(ctx, "SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder", enumName)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = rows.Close()
	}()
	for rows.Next() {
		var label string
		if err := rows.Scan(&label); err != nil {
			return nil, err
		}
		result = append(result, label)
	}
	return result, nil
}
func (p *ProjectsRepository) GetProjects(ctx context.Context, offset int, limit int, opts ...projectdomain.ProjectOption) (projectdomain.Projects, error) {
	var projects []*projectdomain.Project

	q := &projectdomain.ProjectQuery{}
	for _, opt := range opts {
		if opt != nil {
			opt(q)
		}
	}

	var sb strings.Builder
	sb.WriteString("SELECT p.id FROM projects p")

	args := make([]any, 0, len(q.Args)+2)
	args = append(args, q.Args...)

	if len(q.Where) > 0 {
		sb.WriteString(" WHERE ")
		sb.WriteString(strings.Join(q.Where, " AND "))
	}

	sb.WriteString(" ORDER BY p.created_at DESC, p.id DESC")

	offPH := "$" + strconv.Itoa(len(args)+1)
	args = append(args, offset)
	sb.WriteString(" OFFSET ")
	sb.WriteString(offPH)

	if limit > 0 {
		limPH := "$" + strconv.Itoa(len(args)+1)
		args = append(args, limit)
		sb.WriteString(" LIMIT ")
		sb.WriteString(limPH)
	}

	rows, err := p.DB.QueryContext(ctx, sb.String(), args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	for rows.Next() {
		var id uuid.UUID
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		project, err := getProject(ctx, id, p.DB)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return projects, nil
}

func (p *ProjectsRepository) ToggleLike(ctx context.Context, id uuid.UUID, userID uint) error {
	if userID == 0 {
		return errors.New("user is empty")
	}
	var set bool
	if err := p.DB.QueryRowContext(ctx, `select toggle_project_like($1::uuid, $2::bigint)`, id, userID).Scan(&set); err != nil {
		return err
	}
	_ = set
	return nil
}

var _ statistics.Repository = (*StatisticsRepository)(nil)

func (s *StatisticsRepository) VoteCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, errors.New("since is zero")
	}
	var count uint
	err := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM project_likes WHERE created_at >= $1", since).Scan(&count)
	if err != nil {
		return 0, err
	}
	return uint32(count), nil
}

func (s *StatisticsRepository) GetOnlineUsers(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, errors.New("since is zero")
	}

	var count uint32
	err := s.DB.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT e.actor_id) FILTER ( WHERE e.actor_id != 0 )
		 FROM events e
		 WHERE e.at >= $1`, since,
	).Scan(&count)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (s *StatisticsRepository) GetOfflineUsers(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, errors.New("since is zero")
	}

	var offline int64
	err := s.DB.QueryRowContext(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM users)::bigint -
		  (SELECT COUNT(DISTINCT e.actor_id)  FILTER ( WHERE e.actor_id != 0 ) FROM events e WHERE e.at >= $1)::bigint
	`, since).Scan(&offline)
	if err != nil {
		return 0, err
	}

	if offline < 0 {
		offline = 0
	}
	return uint32(offline), nil
}

func (s *StatisticsRepository) NewIdeasCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, errors.New("since is zero")
	}
	var count int
	row := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM projects WHERE created_at >= $1", since)
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return uint32(count), nil
}

func today() time.Time {
	now := time.Now()
	t := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return t
}

func (s *StatisticsRepository) GetForToday(ctx context.Context) (*statpb.StatisticsRecap, error) {
	var stat statpb.StatisticsRecap
	voteCount, err := s.VoteCount(ctx, today())
	if err != nil {
		return nil, err
	}
	newIdeas, err := s.NewIdeasCount(ctx, today())
	if err != nil {
		return nil, err
	}
	offline, err := s.GetOfflineUsers(ctx, today())
	if err != nil {
		return nil, err
	}
	active, err := s.GetOnlineUsers(ctx, today())
	if err != nil {
		return nil, err
	}
	var activity statpb.UsersActivity
	activity.Active = active
	activity.Offline = offline
	stat.NewIdeas = newIdeas
	stat.VoteCount = voteCount
	stat.At = timestamppb.New(today())
	stat.UsersActivity = &activity
	return &stat, nil
}

func (s *StatisticsRepository) SaveStatisticsRecap(ctx context.Context) error {
	lastDay := today().Add(-24 * time.Hour)
	newIdeas, err := s.NewIdeasCount(ctx, lastDay)
	if err != nil {
		return err
	}
	voteCount, err := s.VoteCount(ctx, lastDay)
	if err != nil {
		return err
	}
	usersActivity, err := s.UsersActivity(ctx, lastDay)
	if err != nil {
		return err
	}
	lastActivity, ok := usersActivity[lastDay]
	if !ok {
		lastActivity = &statpb.UsersActivity{}
	}
	if _, err := s.DB.ExecContext(ctx, "INSERT INTO statistics_recap (at, us_activity, new_ideas, vote_count) VALUES ($1, ROW($1, $2)::users_activity_t, $3, $4)", lastDay, lastActivity.Active, lastActivity.Offline, newIdeas, voteCount); err != nil {
		return err
	}
	return nil
}

func (s *StatisticsRepository) StatisticsRecap(ctx context.Context, since time.Time) (map[time.Time]*statpb.StatisticsRecap, error) {
	if since.IsZero() {
		return nil, errors.New("since is zero")
	}

	recap := make(map[time.Time]*statpb.StatisticsRecap)

	rows, err := s.DB.QueryContext(ctx, `
		SELECT
			s.id,
			s.at,
			(s.us_activity).online,
			(s.us_activity).offline,
			s.new_ideas,
			s.vote_count
		FROM statistics_recap s
		WHERE s.at >= $1
	`, since)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := rows.Close(); err != nil {
			logger.Error("failed to close rows", "system.db.rows.close", logger.EventActor{Type: logger.System, ID: 0}, logger.Failure)
		}
	}()

	for rows.Next() {
		var (
			id        int
			at        time.Time
			online    int64
			offline   int64
			newIdeas  int64
			voteCount int64
		)

		if err := rows.Scan(&id, &at, &online, &offline, &newIdeas, &voteCount); err != nil {
			return nil, err
		}

		rec := &statpb.StatisticsRecap{
			Id: strconv.Itoa(id),
			At: timestamppb.New(at),
			UsersActivity: &statpb.UsersActivity{
				Active:  uint32(online),
				Offline: uint32(offline),
			},
			NewIdeas:  uint32(newIdeas),
			VoteCount: uint32(voteCount),
		}

		recap[at] = rec
	}
	recap[today()], err = s.GetForToday(ctx)
	if err != nil {
		return nil, err
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return recap, nil
}

func (s *StatisticsRepository) UsersActivity(ctx context.Context, since time.Time) (map[time.Time]*statpb.UsersActivity, error) {
	if since.IsZero() {
		return nil, errors.New("since is zero")
	}
	data, err := s.StatisticsRecap(ctx, since)
	if err != nil {
		return nil, err
	}
	var activity = make(map[time.Time]*statpb.UsersActivity)
	for at, stat := range data {
		activity[at] = stat.UsersActivity
	}
	return activity, nil
}

func (s *StatisticsRepository) VoteCategories(ctx context.Context, since time.Time, limit int) ([]*statpb.CategoryRecord, error) {
	if since.IsZero() {
		return nil, errors.New("since is zero")
	}

	base := `
		SELECT (pr.info).category AS category, COUNT(*) AS votes
		FROM project_likes pl
		JOIN projects pr ON pr.id = pl.project_id
		WHERE pl.created_at >= $1
		GROUP BY (pr.info).category
		ORDER BY votes DESC
	`

	var (
		rows *sql.Rows
		err  error
	)

	if limit > 0 {
		rows, err = s.DB.QueryContext(ctx, base+` LIMIT $2`, since, limit)
	} else {
		rows, err = s.DB.QueryContext(ctx, base, since)
	}
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var records []*statpb.CategoryRecord
	for rows.Next() {
		var cat sql.NullString
		var votes int64

		if err := rows.Scan(&cat, &votes); err != nil {
			return nil, err
		}

		name := cat.String
		if !cat.Valid {
			name = "Not Specified"
		}

		records = append(records, &statpb.CategoryRecord{
			Name:  name,
			Posts: uint32(votes),
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return records, nil
}

func (s *StatisticsRepository) IdeasRecap(ctx context.Context) (*statpb.IdeasApprovalResponse, error) {
	var resp statpb.IdeasApprovalResponse

	err := s.DB.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE state = 'waiting')  AS waiting,
			COUNT(*) FILTER (WHERE state = 'approved') AS approved,
			COUNT(*) FILTER (WHERE state = 'declined') AS declined
		FROM submissions
	`).Scan(&resp.Waiting, &resp.Approved, &resp.Declined)
	if err != nil {
		return nil, err
	}

	return &resp, nil
}

func (s *StatisticsRepository) MediaCoverage(context.Context) (map[int64]*statpb.MediaCoverageResponseMedia, error) {
	return make(map[int64]*statpb.MediaCoverageResponseMedia), nil
}

func (s *StatisticsRepository) QualityRecap(ctx context.Context) (*statpb.EditorsGradeResponse, error) {
	var good, bad uint
	if err := s.DB.QueryRowContext(ctx, `
		SELECT
		    COUNT (*) FILTER (WHERE rate = 'good') AS good,
		    COUNT (*) FILTER (WHERE rate = 'bad') AS bad
		FROM pictures`).Scan(&good, &bad); err != nil {
		return nil, err
	}
	var grade statpb.EditorsGradeResponse
	var photos statpb.EditorsGradeResponse_Grade
	photos.Good = uint32(good)
	photos.Bad = uint32(bad)
	grade.Photos = &photos
	return &grade, nil
}

func (s *SubmissionsRepository) GetList(ctx context.Context) ([]*submissions.Submission, error) {
	var data []*submissions.Submission
	rows, err := s.DB.QueryContext(ctx, "SELECT s.id, s.project_id, s.state, s.reason FROM submissions s")
	if err != nil {
		return nil, err
	}
	logger.Debug("Received rows", "")
	defer func() { _ = rows.Close() }()
	for rows.Next() {
		var sub submissions.Submission
		var reason sql.NullString
		logger.Debug("Scanning rows", "")
		if err := rows.Scan(&sub.ID, &sub.ProjectID, &sub.State, &reason); err != nil {
			return nil, err
		}
		if sub.State == "declined" && reason.Valid {
			sub.Reason = &reason.String
		}
		logger.Debug("Appending: "+sub.ProjectID.String(), "")
		data = append(data, &sub)
	}
	logger.Debug("Returning", "")
	return data, nil
}

func (s *SubmissionsRepository) AlreadySetted(ctx context.Context, id int32) (bool, error) {
	if id == 0 {
		return false, errors.New("invalid id")
	}
	var setted bool
	if err := s.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM submissions WHERE id = $1 AND state <> 'waiting')", id).Scan(&setted); err != nil {
		return false, err
	}
	return setted, nil
}

func (s *SubmissionsRepository) Approve(ctx context.Context, id int32) error {
	if id == 0 {
		return errors.New("invalid id")
	}
	setted, err := s.AlreadySetted(ctx, id)
	if err != nil {
		return err
	}
	if setted {
		return errors.New("idea already moderated")
	}
	_, err = s.DB.ExecContext(ctx, `
		WITH upd AS (
			UPDATE submissions
			SET state = 'approved'
			WHERE id = $1
			RETURNING project_id
		)
		UPDATE projects
		SET status = 'published'
		WHERE id = (SELECT project_id FROM upd);
	`, id)
	return err
}

func (s *SubmissionsRepository) Decline(ctx context.Context, id int32, reason string) error {
	if id == 0 {
		return errors.New("invalid id")
	}
	setted, err := s.AlreadySetted(ctx, id)
	if err != nil {
		return err
	}
	if setted {
		return errors.New("idea already moderated")
	}
	if _, err := s.DB.ExecContext(ctx, "UPDATE submissions SET state = 'declined', reason = $1 WHERE id = $2", reason, id); err != nil {
		return err
	}
	return nil
}

var _ verification.Repository = (*VerificationRepository)(nil)

func (v *VerificationRepository) Create(ctx context.Context, email string, purpose verification.Purpose, ip string, userAgent string, ttl time.Duration) (string, error) {
	if email == "" || !purpose.IsValid() || ip == "" || userAgent == "" || ttl == 0 {
		return "", errors.New("invalid params")
	}
	token, err := generateString(32)
	if err != nil {
		return "", err
	}
	if _, err = v.DB.ExecContext(ctx, "INSERT INTO auth_action_tokens ( email, purpose, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)", email, purpose.String(), []byte(token), time.Now().Add(ttl), ip, userAgent); err != nil {
		return "", err
	}
	return token, nil
}

func (v *VerificationRepository) GetRecord(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if !purpose.IsValid() || token == "" {
		return nil, errors.New("params in empty")
	}
	var record verification.TokenRecord
	if err := v.DB.QueryRowContext(ctx, "SELECT id, email, purpose, expires_at, used_at FROM auth_action_tokens WHERE token_hash = $1 AND purpose = $2", token, purpose.String()).Scan(
		&record.ID,
		&record.Email,
		&record.Purpose,
		&record.ExpiresAt,
		&record.UsedAt,
	); err != nil {
		return nil, err
	}
	return &record, nil
}

func (v *VerificationRepository) Consume(ctx context.Context, purpose verification.Purpose, token string) (*verification.TokenRecord, error) {
	if !purpose.IsValid() || token == "" {
		return nil, errors.New("invalid params")
	}
	var exists bool
	if err := v.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM auth_action_tokens WHERE token_hash = $1 AND purpose = $2)", token, purpose.String()).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("not found")
	}
	if _, err := v.DB.ExecContext(ctx, "UPDATE auth_action_tokens SET used_at = $1 WHERE token_hash = $2 AND purpose = $3", time.Now(), token, purpose.String()); err != nil {
		return nil, err
	}
	data, err := v.GetRecord(ctx, purpose, token)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (v *VerificationRepository) BanEmail(ctx context.Context, email string, reason string) error {
	if email == "" || reason == "" {
		return errors.New("params is empty")
	}
	if _, err := v.DB.ExecContext(ctx, "INSERT INTO banned_emails (email, reason) VALUES ($1, $2)", email, reason); err != nil {
		return err
	}
	return nil
}

func (v *VerificationRepository) IsBanned(ctx context.Context, email string) (bool, error) {
	if email == "" {
		return false, errors.New("param is empty")
	}
	var found bool
	if err := v.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM banned_emails WHERE email = $1)", email).Scan(&found); err != nil {
		return false, err
	}
	return found, nil
}

var _ maintenance.Repository = (*MaintenanceRepository)(nil)

func (m *MaintenanceRepository) CheckIsActive(ctx context.Context) (bool, error) {
	var active bool
	if err := m.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM maintenance m WHERE m.status = 'in progress')").Scan(&active); err != nil {
		return false, err
	}
	return active, nil
}

func (m *MaintenanceRepository) SetActive(ctx context.Context, id uuid.UUID) error {
	_, err := m.DB.ExecContext(ctx, "UPDATE maintenance SET status = 'in progress', actual_start_at = $1 WHERE id = $2", time.Now(), id)
	return err
}

func (m *MaintenanceRepository) IsPlanned(ctx context.Context) (bool, error) {
	var planned bool
	if err := m.DB.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM maintenance m WHERE m.status = 'scheduled')").Scan(&planned); err != nil {
		return false, err
	}
	return planned, nil
}

func (m *MaintenanceRepository) GetData(ctx context.Context) (*maintenance.Information, error) {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return nil, err
	}
	if !active {
		return nil, errors.New("maintenance is not active")
	}
	var info maintenance.Information
	var actual_end sql.NullTime
	var by uint
	if err := m.DB.QueryRowContext(ctx, "SELECT m.* FROM maintenance m WHERE m.status = 'in progress'").Scan(&info.ID, &info.Description, &info.Status, &info.Scope, &info.Type, &info.Planned.Start, &info.Planned.End, &info.Actual.Start, &actual_end, &info.CreatedAt, &by); err != nil {
		return nil, err
	}
	_ = actual_end
	info.CalledBy, err = getAuthor(ctx, by, m.DB)
	if err != nil {
		return nil, err
	}
	return &info, nil
}

func (m *MaintenanceRepository) Start(ctx context.Context, req maintenance.CreateST, by uint) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if active {
		return errors.New("maintenance already active")
	}
	var typ string = "planned"
	var scope string = "all"
	if req.PlannedStart.IsZero() {
		req.PlannedStart = time.Now()
		typ = "emergency"
	}
	if req.Scope != nil {
		scope = *req.Scope
	}
	_, err = m.DB.ExecContext(ctx, "INSERT INTO maintenance (description, scope, type, planned_start_at, planned_end_at, called_by) VALUES ($1, $2, $3, $4, $5, $6)", req.Description, scope, typ, req.PlannedStart, req.PlannedEnd, by)
	return err
}

func (m *MaintenanceRepository) Edit(ctx context.Context, req maintenance.EditST) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if !active {
		return errors.New("maintenance is not active")
	}
	if req.Description == nil && req.Scope == nil {
		return errors.New("params is nil")
	}
	if req.Description != nil {
		if _, err := m.DB.ExecContext(ctx, "UPDATE maintenance SET description = $1 WHERE status = 'in progress'", *req.Description); err != nil {
			return err
		}
	}
	if req.Scope != nil {
		if _, err := m.DB.ExecContext(ctx, "UPDATE maintenance SET scope = $1 WHERE status = 'in progress'", *req.Scope); err != nil {
			return err
		}
	}
	return nil
}

func (m *MaintenanceRepository) Complete(ctx context.Context) error {
	active, err := m.CheckIsActive(ctx)
	if err != nil {
		return err
	}
	if !active {
		return errors.New("maintenance is not active")
	}
	if _, err := m.DB.ExecContext(ctx, "UPDATE maintenance SET status = 'completed', actual_end_at = $1 WHERE status = 'in progress'", time.Now()); err != nil {
		return err
	}
	return nil
}

func (m *MaintenanceRepository) GetList(ctx context.Context) (maintenance.Informations, error) {
	var list maintenance.Informations
	rows, err := m.DB.QueryContext(ctx, "SELECT * FROM maintenance")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r maintenance.Information
		var actual_start, actual_end sql.NullTime
		var calledby uint
		if err := rows.Scan(&r.ID, &r.Description, &r.Status, &r.Scope, &r.Type, &r.Planned.Start, &r.Planned.End, &actual_start, &actual_end, &r.CreatedAt, &calledby); err != nil {
			return nil, err
		}
		r.CalledBy, err = getAuthor(ctx, calledby, m.DB)
		if err != nil {
			return nil, err
		}
		if actual_start.Valid {
			r.Actual.Start = actual_start.Time
		}
		if actual_end.Valid {
			r.Actual.End = actual_end.Time
		}
		list = append(list, &r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

/*
 * type Repository interface {
	Create(ctx context.Context, name, email, topic, brief string, user uint) (uuid.UUID, error)
	CreateMessage(ctx context.Context, id uuid.UUID, content string) error
	Accept(ctx context.Context, id uuid.UUID, who uint) error
	Info(ctx context.Context, id uuid.UUID) (*TicketInfo, error)
	List(ctx context.Context) ([]*TicketInfo, error)
	Messages(ctx context.Context, id uuid.UUID) ([]*TicketMessage, error)
	Close(ctx context.Context, id uuid.UUID, by string) error
 }
 */
 
 var _ tickets.Repository = (*TicketsRepository)(nil)
 
func (t *TicketsRepository) Create(ctx context.Context, name, email string, topic tickets.TicketTopic, brief string) (*uuid.UUID, error) {
	if name == "" || email == "" || topic == "" || !topic.Valid() || brief == "" {
		return nil, errors.New("params is empty")
	}
	var id uuid.UUID
	if err := t.DB.QueryRowContext(ctx, "INSERT INTO tickets (name, email, topic, brief) VALUES ($1, $2, $3, $4) RETURNING id", name, email, topic, brief).Scan(&id); err != nil {
		return nil, err
	}
	return &id, nil
}

func (t *TicketsRepository) CreateMessage(ctx context.Context, id uuid.UUID, content string, author uint) error {
	if content == "" || author == 0 {
		return errors.New("params is empty")
	}
	if _, err := t.DB.ExecContext(ctx, "INSERT INTO ticket_messages (ticket, author, content) VALUES ($1, $2, $3)", id, author, content); err != nil {
		return err
	}
	return nil
}

func (t *TicketsRepository) Accept(ctx context.Context, id uuid.UUID, who uint) error {
	if who == 0 {
		return errors.New("params is empty")
	}
	if _, err := t.DB.ExecContext(ctx, "UPDATE tickets SET acceptor = $1, accepted = $2 WHERE id = $3", who, time.Now(), id); err != nil {
		return err
	}
	return nil
}

type scanner interface {
	Scan(...any) error
}

func (tr *TicketsRepository) parseTicket(ctx context.Context, scanner scanner) (*tickets.Ticket, error) {
	var t tickets.Ticket
	var acceptor sql.NullInt64
	var accepted, closed sql.NullTime
	var closedBy, closeReason sql.NullString
	var err error
	if err = scanner.Scan(&t.Id, &t.Creator.Name, &t.Creator.Email, &t.Mcount, &acceptor, &t.Status, &t.Topic, &t.Brief, &t.CreatedAt, &accepted, &closed, &closedBy, &closeReason); err != nil {
		return nil, err
	}
	if accepted.Valid {
		t.AcceptedAt = &accepted.Time
	}
	if acceptor.Valid {
		t.Acceptor, err = getAuthor(ctx, uint(acceptor.Int64), tr.DB)
		if err != nil {
			return nil, err
		}
	}
	if closed.Valid {
		t.ClosedAt = &closed.Time
	}
	if closedBy.Valid {
		t.CloseBy = tickets.TicketClosedBy(closedBy.String)
	}
	if closeReason.Valid {
		t.CloseReason = closeReason.String
	}
	return &t, nil
}

func (t *TicketsRepository) Info(ctx context.Context, id uuid.UUID) (*tickets.Ticket, error) {
	info, err := t.parseTicket(ctx, t.DB.QueryRowContext(ctx, "SELECT t.* FROM tickets t WHERE t.id = $1", id))
	if err != nil {
		return nil, err
	}
	return info, nil
}

func (t *TicketsRepository) List(ctx context.Context) (tickets.Tickets, error) {
	var ts tickets.Tickets
	rows, err := t.DB.QueryContext(ctx, "SELECT t.* FROM tickets t")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		info, err := t.parseTicket(ctx, rows)
		if err != nil {
			return nil, err
		}
		ts = append(ts, info)
	}
	return ts, nil
}

func (t *TicketsRepository) Messages(ctx context.Context, id uuid.UUID) (tickets.TicketMessages, error) {
	var messages tickets.TicketMessages
	rows, err := t.DB.QueryContext(ctx, "SELECT m.id, m.author, m.content, m.at FROM ticket_messages m WHERE m.ticket = $1", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var message tickets.TicketMessage
		if err := rows.Scan(&message.ID, &message.Author, &message.Content, &message.At); err != nil {
			return nil, err
		}
		messages = append(messages, &message)
	}
	return messages, nil
}

func (t *TicketsRepository) Close(ctx context.Context, id uuid.UUID, by tickets.TicketClosedBy, reason string) error {
	if by == "" || !by.Valid() {
		return errors.New("params is incorrect")
	}
	if by != tickets.ClosedByUser && reason == "" {
		return errors.New("reason not provided")
	}
	if _, err := t.DB.ExecContext(ctx, "UPDATE tickets SET closed = NOW(), close_by = $1, close_reason = $2", by, reason); err != nil {
		return err
	}
	return nil
}