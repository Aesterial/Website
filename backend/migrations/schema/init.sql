create extension if not exists pgcrypto;

-- enums
create type user_rank as enum ('user', 'staff', 'developer');
create type event_level as enum ('info', 'warn', 'error', 'critical');
create type event_result as enum ('success', '-', 'failure');
create type project_categories as enum ('благоустройство', 'дороги и тротуары', 'освещение', 'детские площадки', 'парки и скверы', 'другое');
create type project_vote_status as enum ('archived', 'implementing', 'vote in progress', 'closed', 'published', 'in moderation');
create type submissions_state as enum ('approved', 'declined', 'waiting');
create type picture_owner_type as enum ('user', 'project', 'unspecified');
create type picture_rate_state as enum ('good', 'bad', 'neutral');
create type oauth_service_enum as enum ('vk');

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

create type permissions_t as (
    view_other_profile              boolean,
    patch_other_profile             boolean,
    patch_self_profile              boolean,
    delete_self_profile             boolean,
    ban_profile                     boolean,
    unban_profile                   boolean,

    create_idea                     boolean,
    patch_self_idea                 boolean,
    delete_self_idea                boolean,

    patch_other_idea                boolean,
    delete_other_idea               boolean,

    create_comment                  boolean,
    patch_self_comment              boolean,
    delete_self_comment             boolean,
    delete_other_comment            boolean,

    upload_idea_media_self          boolean,
    delete_idea_media_self          boolean,
    delete_idea_media_other         boolean,

    moderate_idea                   boolean,
    moderate_comment_hide           boolean,
    moderate_comment_unhide         boolean,

    patch_idea_status_admin         boolean,
    view_statistics                 boolean,
    view_permissions                boolean,
    manage_permissions              boolean
);

create type users_email_t as (
    address varchar(255),
    verified boolean
);

create type users_rank_t as (
    name user_rank,
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
    permissions permissions_t not null default ROW(true, false, true, false, false, false, true, true, true, false, false, true, true, true, false, true, true, false, false, false, false, false, false, false, false)::permissions_t,

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
    at timestamptz default now()
);

create table user_avatars (
    user_id bigint primary key references users(uid) on delete cascade,
    object_key text not null,
    content_type varchar(64),
    size_bytes bigint,
    updated_at timestamptz not null default now()
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
    v_permissions permissions_t;
begin
    if (new.rank).name is distinct from (old.rank).name then
        select r.permissions
        into v_permissions
        from ranks r
        where r.name = (new.rank).name;

        if v_permissions is null then
            raise exception 'rank % not found', (new.rank).name;
        end if;

        new.permissions := v_permissions;
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

-- load base seed data (psql)
insert into ranks (name, color, description, permissions)
values
    (
        'user',
        null,
        'Default user',
        row(
            true,
            false,
            true,
            false,
            false,
            false,
            true,
            true,
            true,
            false,
            false,
            true,
            true,
            true,
            false,
            true,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false
            )::permissions_t
    ),
    (
        'staff',
        null,
        'Staff member',
        row(
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            false
            )::permissions_t
    ),
    (
        'developer',
        null,
        'Developer',
        row(
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true,
            true
            )::permissions_t
    )
on conflict (name) do update
    set
        color = excluded.color,
        description = excluded.description,
        permissions = excluded.permissions;

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
           or lower((u.email).address) = 'admin@ascendant.ru'
        limit 1;

        if v_uid is null then
            v_password := encode(gen_random_bytes(16), 'hex');
            v_password_hash := crypt(v_password, gen_salt('bf', 12));

            insert into users (username, email, rank, permissions, password)
            values (
                       'admin',
                       row('admin@ascendant.ru', true)::users_email_t,
                       row('staff', null)::users_rank_t,
                       (select r.permissions from ranks r where r.name = 'staff'),
                       v_password_hash
                   )
            returning uid into v_uid;

            insert into seed_credentials (username, email, password)
            values ('admin', 'admin@ascendant.ru', v_password)
            on conflict (username) do update
                set
                    email = excluded.email,
                    password = excluded.password,
                    updated_at = now();
        else
            update users
            set rank = row('staff', null)::users_rank_t
            where uid = v_uid
              and (rank).name is distinct from 'staff';
        end if;
    end $$;
