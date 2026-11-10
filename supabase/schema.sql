-- Christmas List database schema.
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Privacy rules (enforced by row-level security below):
--   * You can see the wishlists of anyone who shares a family with you.
--   * You can see which items family members have claimed, EXCEPT on your own
--     list. The person asking never finds out what's been bought for them.
--   * Your gifts (unclaimed ideas, prices paid, statuses) and budgets are private to you.

-- ── Tables ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  created_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  invite_code text not null unique default left(replace(gen_random_uuid()::text, '-', ''), 12),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user_idx on public.family_members (user_id);

create table public.wish_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  url text,
  image_url text,
  store text,
  price numeric(10, 2) check (price >= 0),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  notes text,
  created_at timestamptz not null default now()
);
create index wish_items_owner_idx on public.wish_items (owner_id);

-- A gift you're giving. When item_id is set, it's a claim on someone's wishlist
-- item (only one person can claim an item). Otherwise it's your own idea.
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid unique references public.wish_items (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  price numeric(10, 2) check (price >= 0),
  status text not null default 'planned' check (status in ('planned', 'bought', 'wrapped')),
  created_at timestamptz not null default now()
);
create index gifts_giver_idx on public.gifts (giver_id);

-- Your spending budgets: one per person, plus an overall one (recipient_id null).
create table public.budgets (
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  recipient_id uuid references public.profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  constraint budgets_owner_recipient_key unique nulls not distinct (owner_id, recipient_id)
);

-- ── Helpers ────────────────────────────────────────────────────────────────

create function public.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members
    where family_id = fid and user_id = auth.uid()
  );
$$;

create function public.shares_family(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.family_members a
    join public.family_members b on a.family_id = b.family_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Whoever creates a family is automatically its first member.
create function public.add_creator_as_member() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.family_members (family_id, user_id) values (new.id, new.created_by);
  return new;
end;
$$;
create trigger families_add_creator
  after insert on public.families
  for each row execute function public.add_creator_as_member();

-- Join a family with its invite code.
create function public.join_family(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select id into fid from public.families where invite_code = lower(trim(code));
  if fid is null then
    raise exception 'That invite code doesn''t match a family';
  end if;
  insert into public.family_members (family_id, user_id)
    values (fid, auth.uid())
    on conflict do nothing;
  return fid;
end;
$$;
revoke execute on function public.join_family(text) from public, anon;
grant execute on function public.join_family(text) to authenticated;

-- ── Row-level security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.wish_items enable row level security;
alter table public.gifts enable row level security;
alter table public.budgets enable row level security;

grant select, insert, update, delete on
  public.profiles, public.families, public.family_members,
  public.wish_items, public.gifts, public.budgets
to authenticated;

-- profiles
create policy "read own and family profiles" on public.profiles
  for select to authenticated using (id = auth.uid() or public.shares_family(id));
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- families
create policy "members read family" on public.families
  for select to authenticated using (public.is_family_member(id) or created_by = auth.uid());
create policy "create family" on public.families
  for insert to authenticated with check (created_by = auth.uid());
create policy "members rename family" on public.families
  for update to authenticated
  using (public.is_family_member(id)) with check (public.is_family_member(id));

-- family_members (joining goes through join_family)
create policy "members read membership" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));
create policy "leave family" on public.family_members
  for delete to authenticated using (user_id = auth.uid());

-- wish_items
create policy "read own and family wishlists" on public.wish_items
  for select to authenticated using (owner_id = auth.uid() or public.shares_family(owner_id));
create policy "add own items" on public.wish_items
  for insert to authenticated with check (owner_id = auth.uid());
create policy "edit own items" on public.wish_items
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "delete own items" on public.wish_items
  for delete to authenticated using (owner_id = auth.uid());

-- gifts: your own, plus claims on family members' items (never claims on yours)
create policy "read own gifts and family claims" on public.gifts
  for select to authenticated using (
    giver_id = auth.uid()
    or (item_id is not null and recipient_id <> auth.uid() and public.shares_family(recipient_id))
  );
create policy "add gifts for family" on public.gifts
  for insert to authenticated with check (
    giver_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.shares_family(recipient_id)
    and (item_id is null or exists (
      select 1 from public.wish_items w where w.id = item_id and w.owner_id = recipient_id
    ))
  );
create policy "update own gifts" on public.gifts
  for update to authenticated
  using (giver_id = auth.uid())
  with check (
    giver_id = auth.uid()
    and (item_id is null or exists (
      select 1 from public.wish_items w where w.id = item_id and w.owner_id = recipient_id
    ))
  );
create policy "delete own gifts" on public.gifts
  for delete to authenticated using (giver_id = auth.uid());

-- budgets
create policy "own budgets" on public.budgets
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
