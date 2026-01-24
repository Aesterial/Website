create extension if not exists pgcrypto;
create extension if not exists citext;

-- enums
create type event_level as enum ('info', 'warn', 'error', 'critical');
create type event_result as enum ('success', '-', 'failure');
create type project_categories as enum ('благоустройство', 'дороги и тротуары', 'освещение', 'детские площадки', 'парки и скверы', 'другое');
create type project_vote_status as enum ('archived', 'implementing', 'vote in progress', 'closed', 'published', 'in moderation');
create type submissions_state as enum ('approved', 'declined', 'waiting');
create type picture_owner_type as enum ('user', 'project', 'unspecified');
create type picture_rate_state as enum ('good', 'bad', 'neutral');
create type oauth_service_enum as enum ('vk');
create type verification_purpose as enum ('verify_email', 'reset_password');

create type picture_t as (
    content_type varchar(64),
    pic_id uuid,
    size_bytes int,
    updated timestamptz
);

create type project_location_t as (
    city varchar(64), -- кемерово
    street varchar(64), -- проспект ленина
    house varchar(64) -- дом 4
);

create type project_info_t as (
    title varchar(32),
    description text,
    category project_categories,
    location project_location_t
);

-- projects.*
create type projects_update_permissions_t as ("all" boolean, own boolean, "any" boolean);
create type projects_archive_permissions_t as (own boolean, "any" boolean);
create type projects_delete_permissions_t as ("all" boolean, own boolean, "any" boolean);

create type projects_permissions_t as (
  "all"    boolean,  -- projects.*
  "create" boolean,
  "view"   boolean,
  vote   boolean,
  "update" projects_update_permissions_t,   -- projects.update.*
  archive projects_archive_permissions_t,   -- projects.archive.own/any
  "delete" projects_delete_permissions_t    -- projects.delete.*
);

-- tickets.*
create type tickets_view_list_permissions_t as (own boolean, "any" boolean);

create type tickets_message_create_permissions_t as ("all" boolean, accepted boolean, "any" boolean);
create type tickets_message_t as ("create" tickets_message_create_permissions_t); -- tickets.message.create.*

create type tickets_close_permissions_t as ("all" boolean, accepted boolean, "any" boolean);

create type tickets_permissions_t as (
  "all"      boolean, -- tickets.*
  "create"   boolean,
  view_list tickets_view_list_permissions_t, -- tickets.view_list.own/any
  accept   boolean,
  message  tickets_message_t,    -- tickets.message.create.*
  "close"  tickets_close_permissions_t       -- tickets.close.*
);

-- submissions.*
create type submissions_permissions_t as ("all" boolean, "view" boolean, accept boolean, decline boolean);

-- statistics.*
create type statistics_activity_users_t as (period boolean);             -- statistics.activity.users.period
create type statistics_activity_permissions_t as ("all" boolean, users statistics_activity_users_t);

create type statistics_submissions_permissions_t as ("all" boolean, recap boolean);    -- statistics.submissions.recap

create type statistics_votes_categories_t as (top boolean);              -- statistics.votes.categories.top
create type statistics_votes_permissions_t as ("all" boolean, categories statistics_votes_categories_t);

create type statistics_media_permissions_t as ("all" boolean, quality boolean, volume boolean);

create type statistics_permissions_t as (
  "all"        boolean,  -- statistics.*
  activity   statistics_activity_permissions_t,
  submissions statistics_submissions_permissions_t,
  votes      statistics_votes_permissions_t,
  media      statistics_media_permissions_t
);

-- users.*
create type users_view_profile_t as (public boolean, privacy boolean);
create type users_view_permissions_t as ("all" boolean, profile users_view_profile_t); -- users.view.*

create type users_settings_change_name_t as (own boolean, "any" boolean);  -- users.settings.change.name.own/any
create type users_settings_change_description_t as (own boolean);        -- users.settings.change.description.own
create type users_settings_change_permissions_t as (
  name        users_settings_change_name_t,
  description users_settings_change_description_t
);

create type users_settings_delete_profile_t as (own boolean);
create type users_settings_delete_avatar_t as (own boolean, "any" boolean);
create type users_settings_delete_description_t as (own boolean, "any" boolean);
create type users_settings_delete_permissions_t as (
  profile     users_settings_delete_profile_t,
  avatar      users_settings_delete_avatar_t,
  description users_settings_delete_description_t
);

create type users_settings_reset_password_t as (own boolean, "any" boolean);
create type users_settings_reset_permissions_t as ("all" boolean, password users_settings_reset_password_t); -- users.settings.reset.*

create type users_settings_permissions_t as (
  "all"    boolean, -- users.settings.*
  "change" users_settings_change_permissions_t,
  "delete" users_settings_delete_permissions_t,
  reset  users_settings_reset_permissions_t
);

create type users_moderation_set_permissions_t as ("all" boolean, rank boolean); -- users.moderation.set.*
create type users_moderation_permissions_t as (
  "all"         boolean, -- users.moderation.*
  ban         boolean,
  ban_forever boolean,
  unban       boolean,
  "set"       users_moderation_set_permissions_t
);

create type users_permissions_t as (
  "all"       boolean, -- users.*
  "view"    users_view_permissions_t,
  settings  users_settings_permissions_t,
  moderation users_moderation_permissions_t
);

-- ranks.*
create type ranks_permissions_t as (
  "all"               boolean, -- ranks.*
  permissions_change boolean,
  "add"             boolean,
  "delete"          boolean,
  edit              boolean
);

-- root .*
create type permissions_t as (
  "all"        boolean, -- .* (global wildcard)
  projects   projects_permissions_t,
  tickets    tickets_permissions_t,
  submissions submissions_permissions_t,
  statistics statistics_permissions_t,
  users      users_permissions_t,
  ranks      ranks_permissions_t
);

create or replace function permissions_empty()
returns permissions_t
language sql
immutable
as $$
select row(
  false,
  row(
      false,
      false,
      false,
      false,
      row(false, false, false)::projects_update_permissions_t,
      row(false, false)::projects_archive_permissions_t,
      row(false, false, false)::projects_delete_permissions_t
  )::projects_permissions_t,
  row(
      false,
      false,
      row(false,false)::tickets_view_list_permissions_t,
      false,
      row(row(false,false,false)::tickets_message_create_permissions_t)::tickets_message_t,
      row(false,false,false)::tickets_close_permissions_t
  )::tickets_permissions_t,
  row(false,false,false,false)::submissions_permissions_t,
  row(
      false,
      row(false, row(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
      row(false,false)::statistics_submissions_permissions_t,
      row(false, row(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
      row(false,false,false)::statistics_media_permissions_t
  )::statistics_permissions_t,
  row(
      false,
      row(false, row(false, false)::users_view_profile_t)::users_view_permissions_t,
      row(
          false,
          row(
              row(false, false)::users_settings_change_name_t,
              row(false)::users_settings_change_description_t
          )::users_settings_change_permissions_t,
          row(
              row(false)::users_settings_delete_profile_t,
              row(false, false)::users_settings_delete_avatar_t,
              row(false, false)::users_settings_delete_description_t
          )::users_settings_delete_permissions_t,
          row(false, row(false, false)::users_settings_reset_password_t)::users_settings_reset_permissions_t
      )::users_settings_permissions_t,
      row(
          false, false, false, false,
          row(false, false)::users_moderation_set_permissions_t
      )::users_moderation_permissions_t
  )::users_permissions_t,
  row(false,false,false,false,false)::ranks_permissions_t
)::permissions_t;
$$;

create or replace function perm_norm_path(p text)
returns text[]
language plpgsql
immutable
as $$
declare
  parts text[];
begin
  if p is null or btrim(p) = '' then
    return array[]::text[];
  end if;

  if lower(btrim(p)) in ('*','.*') then
    return array['all'];
  end if;

  parts := string_to_array(lower(btrim(p)), '.');
  if parts[array_length(parts,1)] = '*' then
    return parts[1:array_length(parts,1)-1] || array['all'];
  end if;

  return parts;
end;
$$;

create or replace function perm_allowed(perms permissions_t, perm text)
returns boolean
language plpgsql
immutable
as $$
declare
  path text[] := perm_norm_path(perm);
  j jsonb := to_jsonb(perms);
  i int;
  prefix text[];
  v jsonb;
begin
  if path is null or array_length(path,1) is null then
    return false;
  end if;

  if (j -> 'all') = 'true'::jsonb then
    return true;
  end if;

  for i in 1..array_length(path,1) loop
    prefix := path[1:i];
    v := jsonb_extract_path(j, variadic (prefix || array['all']));
    if v = 'true'::jsonb then
      return true;
    end if;
  end loop;

  v := jsonb_extract_path(j, variadic path);
  return v = 'true'::jsonb;
end;
$$;

create or replace function perm_set(p permissions_t, perm text, state boolean)
returns permissions_t
language plpgsql
immutable
as $$
declare
  path text[] := perm_norm_path(perm);
  j jsonb := to_jsonb(p);
  outj jsonb;
begin
  if path is null or array_length(path,1) is null then
    return p;
  end if;

  outj := jsonb_set(j, path, to_jsonb(state), true);

  -- обратно в composite
  return jsonb_populate_record(null::permissions_t, outj);
end;
$$;

create type users_email_t as (
    address varchar(255),
    verified boolean
);

create type users_rank_t as (
    name text,
    expires timestamptz
);

create type user_settings_t as (
    display_name varchar(255),
    avatar picture_t,
    session_live_time int
);

-- users table with struct columns
create table users (
    uid bigint generated always as identity primary key,
    username varchar(64) not null,

    email users_email_t not null default ROW('', false)::users_email_t,
    settings user_settings_t not null default ROW('', ROW(NULL, NULL, NULL, NULL)::picture_t, 30)::user_settings_t,
    rank users_rank_t not null default ROW('user', NULL)::users_rank_t,
    permissions permissions_t not null default permissions_empty(),

    joined timestamptz not null default now(),

    password varchar(255),

    -- constraints for struct fields
    constraint users_email_address_nn check (((email).address) is not null),
    constraint users_email_verified_nn check (((email).verified) is not null),

    constraint users_session_live_time_ok check (((settings).session_live_time) in (7, 30, -1)),

    constraint users_rank_name_nn check (((rank).name) is not null),
    constraint users_rank_expires_ok check (((rank).expires) is null or (rank).expires > joined)
);

-- uniqueness / indexes on nested fields
create unique index users_username_uq on users (username);
create unique index users_email_uq on users (lower(((email).address)));
create index users_rank_name_idx on users (((rank).name));
create index users_joined_idx on users (joined);

-- oauth users
create table oauth (
    uid bigint not null,
    service oauth_service_enum not null,
    linked_id text not null,
    at timestamptz not null default now(),
    constraint oauth_service_uid_uniq unique (service, uid)
);

-- pictures (avatars/photos)
create table pictures (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    owner text not null,
    owner_type picture_owner_type not null default 'unspecified',
    info picture_t,
    rate picture_rate_state not null default 'neutral',
    at timestamptz not null default now()
);

create table user_avatars (
    user_id bigint primary key references users(uid) on delete cascade,
    object_key text not null,
    content_type varchar(64),
    size_bytes bigint,
    updated_at timestamptz not null default now()
);

create table ranks (
    name text primary key,
    color int not null default 0,
    description text not null default '',
    permissions permissions_t not null default permissions_empty(),
    added_at timestamptz not null default now()
);

create unique index user_avatars_object_key_uq on user_avatars (object_key);

-- projects
create table projects (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    author_uid bigint not null references users(uid) on delete restrict,

    info project_info_t not null,
    status project_vote_status not null default 'in moderation',

    likes_count int not null default 0 check (likes_count >= 0),

    created_at timestamptz not null default now()
);

create index projects_author_uid_idx on projects (author_uid);
create index project_category_idx on projects (((info).category));
create index projects_city_idx on projects ((((info).location).city));
create index projects_created_at_idx on projects (created_at);

CREATE OR REPLACE FUNCTION projects_autoset_status()
    RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status IN ('in moderation', 'closed', 'archived', 'implementing') THEN
        RETURN NEW;
    END IF;

    IF NEW.likes_count = 0 THEN
        NEW.status := 'published';
    ELSE
        NEW.status := 'vote in progress';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_autoset_status ON projects;

CREATE TRIGGER trg_projects_autoset_status
    BEFORE INSERT OR UPDATE OF likes_count, status
    ON projects
    FOR EACH ROW
EXECUTE FUNCTION projects_autoset_status();

create table project_photos (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    project_id uuid not null references projects(id) on delete cascade,
    object_key text not null,
    content_type varchar(64),
    size_bytes bigint,
    created_at timestamptz not null default now()
);

create index project_photos_project_id_idx on project_photos (project_id);
create unique index project_photos_object_key_uq on project_photos (object_key);

create table project_likes (
    project_id uuid not null references projects(id) on delete cascade,
    user_uid bigint not null references users(uid) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (project_id, user_uid)
);

create index project_likes_user_uid_idx on project_likes (user_uid);
create index project_likes_project_id_idx on project_likes (project_id);
create index project_likes_created_at_idx on project_likes (created_at);

create or replace function toggle_project_like(p_project_id uuid, p_user_uid bigint)
    returns boolean
    language plpgsql
as $$
declare
    v_status project_vote_status;
    v_removed boolean;
    v_liked  boolean;
begin
    select status
    into v_status
    from projects
    where id = p_project_id
        for update;

    if not found then
        raise exception 'project % not found', p_project_id;
    end if;

    if v_status in ('archived', 'closed', 'in moderation') then
        select exists (
            select 1
            from project_likes
            where project_id = p_project_id
              and user_uid   = p_user_uid
        )
        into v_liked;

        return v_liked;
    end if;

    delete from project_likes
    where project_id = p_project_id
      and user_uid   = p_user_uid
    returning true into v_removed;

    if v_removed then
        update projects
        set likes_count = likes_count - 1
        where id = p_project_id
          and likes_count > 0;

        return false;
    end if;

    insert into project_likes (project_id, user_uid)
    values (p_project_id, p_user_uid)
    on conflict do nothing;

    if found then
        update projects
        set likes_count = likes_count + 1
        where id = p_project_id;

        return true;
    end if;

    return true;
end $$;

-- sync user.permissions when rank name changes
create or replace function sync_user_permissions_from_rank()
    returns trigger
    language plpgsql
as $$
declare
    v_permissions_json jsonb;
begin
    if (new.rank).name is distinct from (old.rank).name then
        select to_jsonb(r.permissions)
        into v_permissions_json
        from ranks r
        where r.name = (new.rank).name;

        if v_permissions_json is null then
            raise exception 'rank % not found', (new.rank).name;
        end if;

        new.permissions := jsonb_populate_record(null::permissions_t, v_permissions_json);
    end if;

    return new;
end $$;

create trigger users_permissions_from_rank
    before update of rank on users
    for each row
    execute function sync_user_permissions_from_rank();

-- bans
create table bans (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    executor bigint not null references users(uid) on delete restrict,
    target bigint not null unique references users(uid) on delete restrict,
    reason varchar(255),
    at timestamptz not null default now(),
    expires timestamptz,
    check (expires is null or expires > at),
    check (executor <> target)
);

create index bans_target_idx on bans(target);
create index bans_executor_idx on bans(executor);

-- events
create table events (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    at timestamptz not null default now(),

    event_type varchar(255) not null,
    level event_level not null,
    message text,

    actor_type varchar(255) not null,
    actor_id bigint,

    trace_id varchar(255) not null,
    result event_result not null
);

-- verifications and resets
create table auth_action_tokens (
    id bigserial primary key,
    email citext not null,
    purpose verification_purpose not null,
    token_hash bytea not null,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null,
    used_at timestamptz,
    ip inet,
    user_agent text
);

create unique index auth_action_tokens_one_active
    on auth_action_tokens (email, purpose)
    where used_at is null;

create index auth_action_tokens_expires_idx on auth_action_tokens (expires_at);
create index auth_action_tokens_hash_idx on auth_action_tokens (token_hash);

-- banned emails
create table banned_emails (
    id bigserial primary key,
    email citext not null unique,
    reason text not null default 'email is not valid',
    created_at timestamptz not null default now()
);

-- sessions
create table sessions (
    id uuid primary key,
    uid bigint not null,

    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    expires timestamptz,
    revoked bool not null default false,
    mfa_complete bool not null default false,

    user_agent_hash text not null
);

create index events_at_idx on events(at);
create index events_trace_id_idx on events(trace_id);
create index sessions_uid_idx on sessions (uid);

create type users_activity_t as (
    offline bigint,
    online bigint
);

create table statistics_recap (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    at timestamptz not null,
    us_activity users_activity_t not null default row(0,0)::users_activity_t,
    new_ideas bigint not null default 0,
    vote_count bigint not null default 0
);

create index statistics_recap_at_idx on statistics_recap (at);

create table submissions (
    id bigint generated always as identity primary key,
    project_id uuid not null references projects(id),
    state submissions_state not null default 'waiting',
    reason text default null
);

create index submissions_project_id_idx on submissions (project_id);
create index submissions_state_idx on submissions (state);

create type maintenance_status as enum ('scheduled', 'in progress', 'completed');
create type maintenance_scope as enum ('all', 'auth', 'projects');
create type maintenance_type as enum ('emergency', 'planned');

create table maintenance (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    description text not null,
    status maintenance_status not null default 'scheduled',
    scope maintenance_scope not null default 'all',
    type maintenance_type not null,
    planned_start_at timestamptz not null,
    planned_end_at timestamptz not null,
    actual_start_at timestamptz,
    actual_end_at timestamptz,
    created_at timestamptz not null default now(),
    called_by bigint not null,
    constraint maintenance_planned_at_check check (planned_end_at > planned_start_at),
    constraint maintenance_actual_start_check check (actual_end_at is null or actual_start_at is not null),
    constraint maintenance_actual_end_check check (actual_end_at is null or actual_end_at >= actual_start_at)
);

create index maintenance_status_idx on maintenance (status);
create index maintenance_planned_start_at_idx on maintenance (planned_start_at);
create index maintenance_planned_end_at_idx on maintenance (planned_end_at);
create type ticket_status as enum ('в обработке', 'закрыт', 'ожидает');
create type ticket_topic as enum ('аккаунт и доступ', 'проект и заявка', 'техническая проблема', 'другое');
create type ticket_close_by as enum ('user', 'staff', 'system');
create type ticket_message_author as enum ('user', 'staff', 'system');

create table tickets (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    name  text,
    email text,
    authorized boolean not null default false,
    authorized_uid bigint,
    requestor_token text,
    count bigint not null default 0,
    acceptor bigint,
    status ticket_status not null default 'ожидает',
    topic  ticket_topic  not null,
    brief  text not null,
    created  timestamptz not null default now(),
    accepted timestamptz,
    closed   timestamptz,
    closed_by ticket_close_by,
    close_reason text,
    constraint tickets_requestor_check
      check (
        (authorized = true  and authorized_uid is not null)
        or
        (authorized = false and requestor_token is not null)
      )
);

create table ticket_messages (
    id bigint generated always as identity primary key,
    ticket uuid not null references tickets(id) on delete cascade,
    author_type ticket_message_author not null,
    author_uid bigint,
    author_name text,
    author_email text,
    content text not null,
    at timestamptz not null default now(),
    constraint ticket_messages_author_check
      check (
        (author_type in ('user','staff') and author_email is not null)
        or
        (author_type = 'system' and author_uid is null)
      )
);

create index tickets_status_idx   on tickets (status);
create index tickets_acceptor_idx on tickets (acceptor);
create index tickets_created_idx  on tickets (created);

create index ticket_messages_ticket_at_idx on ticket_messages (ticket, at);
create index ticket_messages_ticket_id_idx on ticket_messages (ticket, id);
create index ticket_messages_author_uid_idx on ticket_messages (author_uid);

create unique index tickets_requestor_token_uq
  on tickets (requestor_token)
  where requestor_token is not null;

-- USER
INSERT INTO ranks(name, color, description, permissions)
VALUES (
    'user'::text,
    11184810, -- #AAAAAA
    'Regular user',
    ROW(
        false, -- root_all
        -- projects
        ROW(
            false, -- projects.all
            true,  -- create
            true,  -- view
            true,  -- vote
            ROW(false, true,  false)::projects_update_permissions_t,  -- update: own
            ROW(true,  false)::projects_archive_permissions_t,        -- archive: own
            ROW(false, true,  false)::projects_delete_permissions_t   -- delete: own
        )::projects_permissions_t,
        -- tickets
        ROW(
            false, -- tickets.all
            true,  -- create
            ROW(true, false)::tickets_view_list_permissions_t,        -- view_list: own
            false, -- accept
            ROW(ROW(false, true, false)::tickets_message_create_permissions_t)::tickets_message_t, -- message: accepted
            ROW(false, true, false)::tickets_close_permissions_t           -- close: accepted
        )::tickets_permissions_t,
        -- submissions
        ROW(false, false, false, false)::submissions_permissions_t,
        -- statistics
        ROW(
            false,
            ROW(false, ROW(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
            ROW(false,false)::statistics_submissions_permissions_t,
            ROW(false, ROW(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
            ROW(false,false,false)::statistics_media_permissions_t
        )::statistics_permissions_t,
        -- users
        ROW(
            false,
            ROW(false, ROW(true, false)::users_view_profile_t)::users_view_permissions_t, -- public yes, privacy no
            ROW(
                false,
                ROW(ROW(true, false)::users_settings_change_name_t, ROW(true)::users_settings_change_description_t)::users_settings_change_permissions_t,
                ROW(ROW(true)::users_settings_delete_profile_t, ROW(true, false)::users_settings_delete_avatar_t, ROW(true, false)::users_settings_delete_description_t)::users_settings_delete_permissions_t,
                ROW(false, ROW(true, false)::users_settings_reset_password_t)::users_settings_reset_permissions_t
            )::users_settings_permissions_t,
            ROW(
                false, false, false, false,
                ROW(false, false)::users_moderation_set_permissions_t
            )::users_moderation_permissions_t
        )::users_permissions_t,
        -- ranks mgmt
        ROW(false, false, false, false, false)::ranks_permissions_t
    )::permissions_t
);

-- SUPPORT (тикеты обрабатывать + модерировать идеи)
INSERT INTO ranks(name, color, description, permissions)
VALUES (
    'support'::text,
    34303, -- #0085FF (пример)
    'Support: process tickets + moderate ideas',
    ROW(
        false, -- root_all
        -- projects (наследуем user + добавляем any для update/archive)
        ROW(
            false,
            true, true, true,
            ROW(false, true,  true)::projects_update_permissions_t,  -- update: own + any
            ROW(true,  true )::projects_archive_permissions_t,       -- archive: own + any
            ROW(false, true,  false)::projects_delete_permissions_t  -- delete: только own (как у user)
        )::projects_permissions_t,
        -- tickets (наследуем user + добавляем очередь/accept/message any)
        ROW(
            false,
            true,
            ROW(true, true)::tickets_view_list_permissions_t, -- own + any
            true, -- accept
            ROW(ROW(false, true, true)::tickets_message_create_permissions_t)::tickets_message_t, -- accepted + any
            ROW(false, true, false)::tickets_close_permissions_t          -- close: accepted
        )::tickets_permissions_t,
        -- submissions (модерация идей)
        ROW(false, true, true, true)::submissions_permissions_t,
        -- statistics (нет)
        ROW(
            false,
            ROW(false, ROW(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
            ROW(false,false)::statistics_submissions_permissions_t,
            ROW(false, ROW(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
            ROW(false,false,false)::statistics_media_permissions_t
        )::statistics_permissions_t,
        -- users (наследуем user; PII пока нет)
        ROW(
            false,
            ROW(false, ROW(true, false)::users_view_profile_t)::users_view_permissions_t,
            ROW(
                false,
                ROW(ROW(true, false)::users_settings_change_name_t, ROW(true)::users_settings_change_description_t)::users_settings_change_permissions_t,
                ROW(ROW(true)::users_settings_delete_profile_t, ROW(true, false)::users_settings_delete_avatar_t, ROW(true, false)::users_settings_delete_description_t)::users_settings_delete_permissions_t,
                ROW(false, ROW(true, false)::users_settings_reset_password_t)::users_settings_reset_permissions_t
            )::users_settings_permissions_t,
            ROW(
                false, false, false, false,
                ROW(false, false)::users_moderation_set_permissions_t
            )::users_moderation_permissions_t
        )::users_permissions_t,
        -- ranks mgmt
        ROW(false, false, false, false, false)::ranks_permissions_t
    )::permissions_t
);

-- MODERATOR
INSERT INTO ranks(name, color, description, permissions)
VALUES (
    'moderator'::text,
    16753920, -- #FFA500 (пример)
    'Moderator: user moderation + content moderation',
    ROW(
        false, -- root_all
        -- projects (наследуем support + delete.any)
        ROW(
            false,
            true, true, true,
            ROW(false, true, true)::projects_update_permissions_t,
            ROW(true,  true)::projects_archive_permissions_t,
            ROW(false, true, true)::projects_delete_permissions_t -- own + any
        )::projects_permissions_t,
        -- tickets (наследуем support + close.any)
        ROW(
            false,
            true,
            ROW(true, true)::tickets_view_list_permissions_t,
            true,
            ROW(ROW(false, true, true)::tickets_message_create_permissions_t)::tickets_message_t,
            ROW(false, true, true)::tickets_close_permissions_t -- accepted + any
        )::tickets_permissions_t,
        -- submissions (как у support)
        ROW(false, true, true, true)::submissions_permissions_t,
        -- statistics (нет)
        ROW(
            false,
            ROW(false, ROW(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
            ROW(false,false)::statistics_submissions_permissions_t,
            ROW(false, ROW(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
            ROW(false,false,false)::statistics_media_permissions_t
        )::statistics_permissions_t,
        -- users (добавляем PII + ban/unban)
        ROW(
            false,
            ROW(false, ROW(true, true)::users_view_profile_t)::users_view_permissions_t, -- public + privacy
            ROW(
                false,
                ROW(ROW(true, false)::users_settings_change_name_t, ROW(true)::users_settings_change_description_t)::users_settings_change_permissions_t,
                ROW(ROW(true)::users_settings_delete_profile_t, ROW(true, false)::users_settings_delete_avatar_t, ROW(true, false)::users_settings_delete_description_t)::users_settings_delete_permissions_t,
                ROW(false, ROW(true, false)::users_settings_reset_password_t)::users_settings_reset_permissions_t
            )::users_settings_permissions_t,
            ROW(
                false,
                true,  -- ban
                true,  -- ban_forever
                true,  -- unban
                ROW(false, false)::users_moderation_set_permissions_t -- set.rank НЕ даём
            )::users_moderation_permissions_t
        )::users_permissions_t,
        -- ranks mgmt (нет)
        ROW(false, false, false, false, false)::ranks_permissions_t
    )::permissions_t
);

-- STAFF (шире доступ, но без управления рангами/правами)
INSERT INTO ranks(name, color, description, permissions)
VALUES (
    'staff'::text,
    8388736, -- #8000C0 (пример)
    'Staff: operations + statistics + account support',
    ROW(
        false, -- root_all
        -- projects (как moderator)
        ROW(
            false,
            true, true, true,
            ROW(false, true, true)::projects_update_permissions_t,
            ROW(true,  true)::projects_archive_permissions_t,
            ROW(false, true, true)::projects_delete_permissions_t
        )::projects_permissions_t,
        -- tickets (как moderator)
        ROW(
            false,
            true,
            ROW(true, true)::tickets_view_list_permissions_t,
            true,
            ROW(ROW(false, true, true)::tickets_message_create_permissions_t)::tickets_message_t,
            ROW(false, true, true)::tickets_close_permissions_t
        )::tickets_permissions_t,
        -- submissions (как moderator)
        ROW(false, true, true, true)::submissions_permissions_t,
        -- statistics (statistics.*)
        ROW(
            true, -- statistics.all = true
            ROW(false, ROW(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
            ROW(false,false)::statistics_submissions_permissions_t,
            ROW(false, ROW(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
            ROW(false,false,false)::statistics_media_permissions_t
        )::statistics_permissions_t,
        -- users (как moderator + сброс/правки для any где есть ключи)
        ROW(
            false,
            ROW(false, ROW(true, true)::users_view_profile_t)::users_view_permissions_t,
            ROW(
                false,
                ROW(ROW(true, true)::users_settings_change_name_t, ROW(true)::users_settings_change_description_t)::users_settings_change_permissions_t, -- name.any = true
                ROW(ROW(true)::users_settings_delete_profile_t, ROW(true, true)::users_settings_delete_avatar_t, ROW(true, true)::users_settings_delete_description_t)::users_settings_delete_permissions_t, -- avatar.any/desc.any = true
                ROW(true, ROW(true, true)::users_settings_reset_password_t)::users_settings_reset_permissions_t -- reset.* + password any
            )::users_settings_permissions_t,
            ROW(
                false,
                true, true, true,
                ROW(false, false)::users_moderation_set_permissions_t
            )::users_moderation_permissions_t
        )::users_permissions_t,
        -- ranks mgmt (нет)
        ROW(false, false, false, false, false)::ranks_permissions_t
    )::permissions_t
);

-- ROOT (.*)
INSERT INTO ranks(name, color, description, permissions)
VALUES (
    'root'::text,
    16711680, -- #FF0000 (пример)
    'Root: full access (.*)',
    ROW(
        true, -- root_all = true (.*)
        ROW(false,false,false,false,
            ROW(false,false,false)::projects_update_permissions_t,
            ROW(false,false)::projects_archive_permissions_t,
            ROW(false,false,false)::projects_delete_permissions_t
        )::projects_permissions_t,
        ROW(false,false,
            ROW(false,false)::tickets_view_list_permissions_t,
            false,
            ROW(ROW(false,false,false)::tickets_message_create_permissions_t)::tickets_message_t,
            ROW(false,false,false)::tickets_close_permissions_t
        )::tickets_permissions_t,
        ROW(false,false,false,false)::submissions_permissions_t,
        ROW(false,
            ROW(false, ROW(false)::statistics_activity_users_t)::statistics_activity_permissions_t,
            ROW(false,false)::statistics_submissions_permissions_t,
            ROW(false, ROW(false)::statistics_votes_categories_t)::statistics_votes_permissions_t,
            ROW(false,false,false)::statistics_media_permissions_t
        )::statistics_permissions_t,
        ROW(false,
            ROW(false, ROW(false, false)::users_view_profile_t)::users_view_permissions_t,
            ROW(false,
                ROW(ROW(false, false)::users_settings_change_name_t, ROW(false)::users_settings_change_description_t)::users_settings_change_permissions_t,
                ROW(ROW(false)::users_settings_delete_profile_t, ROW(false, false)::users_settings_delete_avatar_t, ROW(false, false)::users_settings_delete_description_t)::users_settings_delete_permissions_t,
                ROW(false, ROW(false, false)::users_settings_reset_password_t)::users_settings_reset_permissions_t
            )::users_settings_permissions_t,
            ROW(false,false,false,false,
                ROW(false,false)::users_moderation_set_permissions_t
            )::users_moderation_permissions_t
        )::users_permissions_t,
        ROW(false,false,false,false,false)::ranks_permissions_t
    )::permissions_t
);

create table if not exists seed_credentials (
                                                username varchar(64) primary key,
                                                email varchar(255) not null,
                                                password text not null,
                                                created_at timestamptz not null default now(),
                                                updated_at timestamptz not null default now()
);

do $$
    declare
        v_password text;
        v_password_hash text;
        v_uid bigint;
    begin
        select u.uid
        into v_uid
        from users u
        where u.username = 'admin'
           or lower((u.email).address) = 'admin@Aesterial.ru'
        limit 1;

        if v_uid is null then
            v_password := encode(gen_random_bytes(16), 'hex');
            v_password_hash := crypt(v_password, gen_salt('bf', 12));

            insert into users (username, email, rank, permissions, password)
            values (
                       'admin',
                       row('admin@aesterial.xyz', true)::users_email_t,
                       row('root', null)::users_rank_t,
                       (select r.permissions from ranks r where r.name = 'root'),
                       v_password_hash
                   )
            returning uid into v_uid;

            insert into seed_credentials (username, email, password)
            values ('admin', 'admin@aesterial.xyz', v_password)
            on conflict (username) do update
                set
                    email = excluded.email,
                    password = excluded.password,
                    updated_at = now();
        else
            update users
            set rank = row('root', null)::users_rank_t
            where uid = v_uid
              and (rank).name is distinct from 'root';
        end if;
    end $$;
