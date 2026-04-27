-- ============================================================================
-- 割り勘ログ - Initial Schema
-- ============================================================================

-- ============= Couples =============
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  default_ratio numeric(3,2) not null default 0.7
    check (default_ratio >= 0 and default_ratio <= 1),
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

-- ============= Couple Members =============
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
-- 1ユーザーは1カップルにのみ所属
create unique index couple_members_user_unique on public.couple_members(user_id);

-- ============= Categories =============
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null,
  color text not null default '#888888',
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index categories_couple_idx on public.categories(couple_id);

-- ============= Expenses =============
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  date date not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  amount integer not null check (amount > 0),
  payer_user_id uuid not null references auth.users(id) on delete restrict,
  ratio_override numeric(3,2)
    check (ratio_override is null or (ratio_override >= 0 and ratio_override <= 1)),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict
);
create index expenses_couple_date_idx on public.expenses(couple_id, date desc);

-- ============= Settlements (精算履歴) =============
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  amount integer not null,
  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid not null references auth.users(id) on delete restrict,
  settled_at timestamptz not null default now(),
  unique (couple_id, year, month)
);

-- ============================================================================
-- ヘルパー関数: ユーザーの所属カップルID
-- ============================================================================
create or replace function public.user_couple_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select couple_id from public.couple_members where user_id = auth.uid() limit 1
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.settlements enable row level security;

-- couples: 自分のカップルのみ閲覧・更新可
create policy "couples_select_own" on public.couples for select
  using (id = public.user_couple_id());
create policy "couples_update_own" on public.couples for update
  using (id = public.user_couple_id());

-- couple_members: 自分のカップルのメンバーは閲覧可、自分のレコードのみ更新可
create policy "couple_members_select" on public.couple_members for select
  using (couple_id = public.user_couple_id() or user_id = auth.uid());
create policy "couple_members_update_own" on public.couple_members for update
  using (user_id = auth.uid());

-- categories: 自分のカップルのカテゴリは全操作可
create policy "categories_all_own" on public.categories for all
  using (couple_id = public.user_couple_id())
  with check (couple_id = public.user_couple_id());

-- expenses: 自分のカップルの支出は全操作可
create policy "expenses_all_own" on public.expenses for all
  using (couple_id = public.user_couple_id())
  with check (couple_id = public.user_couple_id());

-- settlements: 自分のカップルの精算は閲覧・追加可
create policy "settlements_select_own" on public.settlements for select
  using (couple_id = public.user_couple_id());
create policy "settlements_insert_own" on public.settlements for insert
  with check (couple_id = public.user_couple_id());

-- ============================================================================
-- カップル作成 RPC (オーナーとして登録 + デフォルトカテゴリをシード)
-- ============================================================================
create or replace function public.create_couple(p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'User already in a couple';
  end if;

  insert into public.couples default values returning id into v_couple_id;

  insert into public.couple_members (couple_id, user_id, role, display_name)
    values (v_couple_id, auth.uid(), 'owner', p_display_name);

  insert into public.categories (couple_id, name, color, sort_order) values
    (v_couple_id, '食費',     '#FF6B6B', 1),
    (v_couple_id, '外食',     '#FF8C42', 2),
    (v_couple_id, '交通',     '#4ECDC4', 3),
    (v_couple_id, '日用品',   '#06D6A0', 4),
    (v_couple_id, '娯楽',     '#FFD166', 5),
    (v_couple_id, 'その他',   '#C9C9C9', 6);

  return v_couple_id;
end;
$$;

-- ============================================================================
-- カップル参加 RPC (招待トークンから partner として登録)
-- ============================================================================
create or replace function public.join_couple(p_invite_token uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_couple_id from public.couples where invite_token = p_invite_token;
  if v_couple_id is null then
    raise exception 'Invalid invite token';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'User already in a couple';
  end if;

  select count(*) into v_count from public.couple_members where couple_id = v_couple_id;
  if v_count >= 2 then
    raise exception 'Couple is full';
  end if;

  insert into public.couple_members (couple_id, user_id, role, display_name)
    values (v_couple_id, auth.uid(), 'partner', p_display_name);

  return v_couple_id;
end;
$$;

-- ============================================================================
-- 招待トークン再発行 RPC
-- ============================================================================
create or replace function public.regenerate_invite_token()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_couple_id uuid;
  v_new_token uuid;
begin
  v_couple_id := public.user_couple_id();
  if v_couple_id is null then
    raise exception 'Not in a couple';
  end if;

  v_new_token := gen_random_uuid();
  update public.couples set invite_token = v_new_token where id = v_couple_id;
  return v_new_token;
end;
$$;
