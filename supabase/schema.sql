-- ============================================================================
-- SyncCord v2 Supabase schema
-- Run this once in the Supabase SQL editor on a fresh project.
-- It is idempotent: safe to re-run after edits.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILES (extends auth.users)
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    username        text,
    avatar_url      text,
    email           text,
    provider        text,             -- 'email' | 'google' | 'discord'
    discord_username text,
    discord_id      text,
    google_email    text,
    bio             text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_provider_idx on public.profiles (provider);

-- Auto-create a profile row whenever a new auth user is inserted.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
    provider_name text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
    insert into public.profiles (
        id, username, avatar_url, email, provider,
        discord_username, discord_id, google_email
    )
    values (
        new.id,
        coalesce(meta ->> 'user_name', meta ->> 'preferred_username', meta ->> 'full_name', split_part(new.email, '@', 1)),
        coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
        new.email,
        provider_name,
        case when provider_name = 'discord' then coalesce(meta ->> 'user_name', meta ->> 'preferred_username') end,
        case when provider_name = 'discord' then meta ->> 'provider_id' end,
        case when provider_name = 'google' then new.email end
    )
    on conflict (id) do update set
        email = excluded.email,
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        discord_username = coalesce(excluded.discord_username, public.profiles.discord_username),
        discord_id       = coalesce(excluded.discord_id, public.profiles.discord_id),
        google_email     = coalesce(excluded.google_email, public.profiles.google_email),
        updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Touch updated_at on every profile change.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles
    for select using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
    for update using (auth.uid() = id);

-- inserts go through the trigger; explicit insert by clients is not allowed
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
    for insert with check (auth.uid() = id);


-- ----------------------------------------------------------------------------
-- 2. REVIEWS (port of v1 review system)
-- ----------------------------------------------------------------------------

create table if not exists public.reviews (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    username    text,                 -- denormalized snapshot at write time
    avatar_url  text,                 -- denormalized snapshot
    content     text not null check (char_length(content) <= 2000),
    rating      int  not null check (rating between 1 and 5),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists reviews_user_idx on public.reviews (user_id);
create index if not exists reviews_created_idx on public.reviews (created_at desc);

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
    before update on public.reviews
    for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;

drop policy if exists "reviews_read_all" on public.reviews;
create policy "reviews_read_all" on public.reviews
    for select using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews
    for insert with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews
    for update using (auth.uid() = user_id);

drop policy if exists "reviews_delete_own" on public.reviews;
create policy "reviews_delete_own" on public.reviews
    for delete using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. FORUM
-- ----------------------------------------------------------------------------

create table if not exists public.forum_posts (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references public.profiles(id) on delete cascade,
    title       text not null check (char_length(title) between 3 and 200),
    body        text not null check (char_length(body) <= 20000),
    image_url   text,
    tags        text[] not null default '{}',
    score       int not null default 0,
    reply_count int not null default 0,
    is_locked   boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists forum_posts_created_idx on public.forum_posts (created_at desc);
create index if not exists forum_posts_score_idx   on public.forum_posts (score desc);
create index if not exists forum_posts_user_idx    on public.forum_posts (user_id);
create index if not exists forum_posts_tags_idx    on public.forum_posts using gin (tags);

drop trigger if exists forum_posts_touch_updated_at on public.forum_posts;
create trigger forum_posts_touch_updated_at
    before update on public.forum_posts
    for each row execute function public.touch_updated_at();

create table if not exists public.forum_replies (
    id              uuid primary key default gen_random_uuid(),
    post_id         uuid not null references public.forum_posts(id) on delete cascade,
    parent_reply_id uuid     references public.forum_replies(id) on delete cascade,
    user_id         uuid not null references public.profiles(id)  on delete cascade,
    body            text not null check (char_length(body) <= 10000),
    image_url       text,
    score           int  not null default 0,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists forum_replies_post_idx    on public.forum_replies (post_id, created_at);
create index if not exists forum_replies_parent_idx  on public.forum_replies (parent_reply_id);
create index if not exists forum_replies_user_idx    on public.forum_replies (user_id);

drop trigger if exists forum_replies_touch_updated_at on public.forum_replies;
create trigger forum_replies_touch_updated_at
    before update on public.forum_replies
    for each row execute function public.touch_updated_at();

-- Keep forum_posts.reply_count in sync.
create or replace function public.bump_reply_count()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' then
        update public.forum_posts set reply_count = reply_count + 1 where id = new.post_id;
    elsif tg_op = 'DELETE' then
        update public.forum_posts set reply_count = greatest(0, reply_count - 1) where id = old.post_id;
    end if;
    return null;
end;
$$;

drop trigger if exists forum_replies_count_insert on public.forum_replies;
create trigger forum_replies_count_insert
    after insert on public.forum_replies
    for each row execute function public.bump_reply_count();

drop trigger if exists forum_replies_count_delete on public.forum_replies;
create trigger forum_replies_count_delete
    after delete on public.forum_replies
    for each row execute function public.bump_reply_count();

-- Voting: one vote per (user, target).
create table if not exists public.forum_votes (
    user_id     uuid not null references public.profiles(id) on delete cascade,
    target_id   uuid not null,
    target_type text not null check (target_type in ('post', 'reply')),
    value       int  not null check (value in (-1, 1)),
    created_at  timestamptz not null default now(),
    primary key (user_id, target_id)
);

create index if not exists forum_votes_target_idx on public.forum_votes (target_id, target_type);

-- Recompute score on the target after vote insert/update/delete.
create or replace function public.recompute_target_score()
returns trigger language plpgsql as $$
declare
    tid uuid;
    ttype text;
    new_score int;
begin
    tid   := coalesce(new.target_id, old.target_id);
    ttype := coalesce(new.target_type, old.target_type);
    select coalesce(sum(value), 0) into new_score
        from public.forum_votes
        where target_id = tid and target_type = ttype;
    if ttype = 'post' then
        update public.forum_posts set score = new_score where id = tid;
    else
        update public.forum_replies set score = new_score where id = tid;
    end if;
    return null;
end;
$$;

drop trigger if exists forum_votes_recompute on public.forum_votes;
create trigger forum_votes_recompute
    after insert or update or delete on public.forum_votes
    for each row execute function public.recompute_target_score();

-- RLS for forum tables
alter table public.forum_posts   enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_votes   enable row level security;

drop policy if exists "forum_posts_read_all" on public.forum_posts;
create policy "forum_posts_read_all" on public.forum_posts for select using (true);

drop policy if exists "forum_posts_insert_own" on public.forum_posts;
create policy "forum_posts_insert_own" on public.forum_posts for insert with check (auth.uid() = user_id);

drop policy if exists "forum_posts_update_own" on public.forum_posts;
create policy "forum_posts_update_own" on public.forum_posts for update using (auth.uid() = user_id);

drop policy if exists "forum_posts_delete_own" on public.forum_posts;
create policy "forum_posts_delete_own" on public.forum_posts for delete using (auth.uid() = user_id);

drop policy if exists "forum_replies_read_all" on public.forum_replies;
create policy "forum_replies_read_all" on public.forum_replies for select using (true);

drop policy if exists "forum_replies_insert_own" on public.forum_replies;
create policy "forum_replies_insert_own" on public.forum_replies for insert with check (auth.uid() = user_id);

drop policy if exists "forum_replies_update_own" on public.forum_replies;
create policy "forum_replies_update_own" on public.forum_replies for update using (auth.uid() = user_id);

drop policy if exists "forum_replies_delete_own" on public.forum_replies;
create policy "forum_replies_delete_own" on public.forum_replies for delete using (auth.uid() = user_id);

drop policy if exists "forum_votes_read_all" on public.forum_votes;
create policy "forum_votes_read_all" on public.forum_votes for select using (true);

drop policy if exists "forum_votes_insert_own" on public.forum_votes;
create policy "forum_votes_insert_own" on public.forum_votes for insert with check (auth.uid() = user_id);

drop policy if exists "forum_votes_update_own" on public.forum_votes;
create policy "forum_votes_update_own" on public.forum_votes for update using (auth.uid() = user_id);

drop policy if exists "forum_votes_delete_own" on public.forum_votes;
create policy "forum_votes_delete_own" on public.forum_votes for delete using (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 4. STORAGE BUCKETS
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
    ('avatars',       'avatars',       true),
    ('forum-images',  'forum-images',  true)
on conflict (id) do update set public = excluded.public;

-- Storage RLS: anyone can read; only the owner can write to their own folder.
-- Convention: clients upload to `<bucket>/<auth.uid()>/<filename>`.

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
    for select using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_write" on storage.objects;
create policy "avatars_owner_write" on storage.objects
    for insert with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update" on storage.objects
    for update using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete" on storage.objects
    for delete using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "forum_images_public_read" on storage.objects;
create policy "forum_images_public_read" on storage.objects
    for select using (bucket_id = 'forum-images');

drop policy if exists "forum_images_owner_write" on storage.objects;
create policy "forum_images_owner_write" on storage.objects
    for insert with check (
        bucket_id = 'forum-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "forum_images_owner_update" on storage.objects;
create policy "forum_images_owner_update" on storage.objects
    for update using (
        bucket_id = 'forum-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

drop policy if exists "forum_images_owner_delete" on storage.objects;
create policy "forum_images_owner_delete" on storage.objects
    for delete using (
        bucket_id = 'forum-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );


-- ----------------------------------------------------------------------------
-- 5. CONVENIENCE VIEWS
-- ----------------------------------------------------------------------------

-- Reviews joined with the latest profile snapshot (so renamed users show fresh).
create or replace view public.reviews_with_profile as
select
    r.id,
    r.user_id,
    r.content,
    r.rating,
    r.created_at,
    r.updated_at,
    coalesce(p.username, r.username)     as username,
    coalesce(p.avatar_url, r.avatar_url) as avatar_url
from public.reviews r
left join public.profiles p on p.id = r.user_id;

-- Aggregate review stats for the landing page.
create or replace view public.review_stats as
select
    count(*)::int                        as total_reviews,
    coalesce(round(avg(rating)::numeric, 2), 0) as average_rating
from public.reviews;
