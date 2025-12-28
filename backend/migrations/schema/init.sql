create extension if not exists pgcrypto;

-- enums
create type user_rank as enum ('user', 'staff', 'developer');
create type event_level as enum ('info', 'warn', 'error', 'critical');
create type event_result as enum ('success', '-', 'failure');
create type project_categories as enum ('благоустройство', 'дороги и тротуары', 'освещение', 'детские площадки', 'парки и скверы', 'другое');
create type project_vote_status as enum ('archived', 'implementing', 'vote in progress', 'closed', 'published');

create type avatar_t as (
    content_type varchar(64),
    data bytea,
    width int,
    height int,
    size_bytes int,
    updated timestamptz
);

create type project_location_t as (
    city varchar(64), -- кемерово
    street varchar(64), -- проспект ленина
    house varchar(64) -- дом 4 подъезд 4
);

create type project_info_t as (
    title varchar(32),
    description text,
    photos avatar_t[], -- фотки проекта
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
    avatar avatar_t,
    session_live_time int
);

-- users table with struct columns
create table users (
    uid bigint generated always as identity primary key,
    username varchar(64) not null,

    email users_email_t not null default ROW('', false)::users_email_t,
    settings user_settings_t not null default ROW('', ROW(NULL, NULL, NULL, NULL, NULL, NULL)::avatar_t, 30)::user_settings_t,
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

-- projects
create table projects (
    id uuid primary key default pg_catalog.gen_random_uuid(),
    author_uid bigint not null references users(uid) on delete restrict,

    info project_info_t not null,
    status project_vote_status not null default 'published',

    likes_count int not null default 0 check (likes_count >= 0),

    created_at timestamptz not null default now()
);

create index project_category_idx on projects (((info).category));
create index projects_city_idx on projects ((((info).location).city));

create table project_likes (
    project_id uuid not null references projects(id) on delete cascade,
    user_uid bigint not null references users(uid) on delete cascade,
    created_at timestamptz not null default now(),

    primary key (project_id, user_uid)
);

create index project_likes_user_uid_idx on project_likes (user_uid);
create index project_likes_project_id_idx on project_likes (project_id);

create or replace function toggle_project_like(p_project_id uuid, p_user_uid bigint)
    returns boolean
    language plpgsql
    as $$
    declare
    removed boolean;
    begin
    -- если лайк уже есть -> снимаем
    delete from project_likes
    where project_id = p_project_id
    and user_uid = p_user_uid
    returning true into removed;

    if removed then
    update projects
    set likes_count = likes_count - 1
    where id = p_project_id;

    return false;
    end if;

    -- иначе ставим лайк
    insert into project_likes (project_id, user_uid)
    values (p_project_id, p_user_uid)
    on conflict do nothing;

    if found then
    update projects
    set likes_count = likes_count + 1
    where id = p_project_id;
    end if;

    return true;
end $$;

-- ranks
create table ranks (
    name user_rank primary key,
    color int,
    description text,
    permissions permissions_t not null default ROW(true, false, true, false, false, false, true, true, true, false, false, true, true, true, false, true, true, false, false, false, false, false, false, false, false)::permissions_t
);

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
    target bigint not null references users(uid) on delete restrict,
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
