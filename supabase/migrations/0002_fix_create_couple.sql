-- ============================================================================
-- Fix: create_couple / join_couple のパラメータ名ずれと PostgREST スキーマキャッシュ
-- ============================================================================
-- 旧バージョンが異なるパラメータ名 (例: display_name) で作成されていた場合、
-- `create or replace function` ではパラメータ名を変更できないため、
-- 明示的に drop してから作り直す。最後に NOTIFY pgrst で API のスキーマ
-- キャッシュを再読込させる。
-- ============================================================================

drop function if exists public.create_couple(text);
drop function if exists public.join_couple(uuid, text);

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

-- PostgREST にスキーマ再読込を通知
notify pgrst, 'reload schema';
