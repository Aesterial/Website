package db

import (
	"ascendant/backend/internal/domain/login"
	"ascendant/backend/internal/domain/permissions"
	"ascendant/backend/internal/domain/rank"
	"ascendant/backend/internal/domain/sessions"
	"ascendant/backend/internal/domain/user"
	"ascendant/backend/internal/infra/logger"
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
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
		"SELECT (u.settings).session_live_time, u.password, (u.settings).display_name FROM users u WHERE u.uid = $1",
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
	row := u.DB.QueryRowContext(ctx, " SELECT ((u.settings).avatar).content_type, ((u.settings).avatar).data, ((u.settings).avatar).width, ((u.settings).avatar).height, ((u.settings).avatar).size_bytes, ((u.settings).avatar).updated FROM users u WHERE u.uid = $1", uid)
	if err := row.Err(); err != nil {
		return nil, err
	}
	if err := row.Scan(&a.ContentType, &a.Data, &a.Width, &a.Height, &a.SizeBytes, &a.Updated); err != nil {
		return nil, err
	}
	if a.Data == nil {
		s.Avatar = nil
	} else {
		s.Avatar = &a
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
	//if require.Email == "admin@admin.admin" {
	//	if _, err = l.DB.ExecContext(ctx, `
	//		UPDATE users u
	//		SET rank = ROW($1, NULL)::users_rank_t
	//		WHERE u.uid = $2`,
	//		"staff",
	//		id,
	//	); err != nil {
	//		logger.Debug("error: "+err.Error(), "a")
	//		return nil, err
	//	}
	//}
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
