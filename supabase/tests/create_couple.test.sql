-- ============================================================================
-- E2E test: create_couple / join_couple RPC
-- ローカルの素の Postgres + auth_stub.sql + 本番マイグレーションを当てた DB に対して実行する。
-- 実行方法: supabase/tests/run_tests.sh
-- ============================================================================
\set ON_ERROR_STOP on

-- クリーン状態にする
truncate public.couple_members, public.categories, public.expenses,
         public.settlements, public.couples restart identity cascade;
delete from auth.users;

\echo '--- Test 1: create_couple as りゅうすけ ---'

insert into auth.users (id, email)
  values ('11111111-1111-1111-1111-111111111111', 'gibson.red.gin.suke@gmail.com');

set app.current_user_id = '11111111-1111-1111-1111-111111111111';

select public.create_couple('りゅうすけ') as new_couple_id \gset

-- couple_members に owner として登録されていること
do $$
declare v_count int;
begin
  select count(*) into v_count from public.couple_members
    where user_id = '11111111-1111-1111-1111-111111111111'
      and role = 'owner'
      and display_name = 'りゅうすけ';
  if v_count <> 1 then
    raise exception 'TEST FAILED: couple_members rows = %, expected 1', v_count;
  end if;
  raise notice 'TEST OK: couple_members に owner=りゅうすけ が登録された';
end $$;

-- デフォルトカテゴリ 6 件がシードされていること
do $$
declare v_count int;
begin
  select count(*) into v_count from public.categories
    where couple_id = (select couple_id from public.couple_members
                        where user_id = '11111111-1111-1111-1111-111111111111');
  if v_count <> 6 then
    raise exception 'TEST FAILED: categories = %, expected 6', v_count;
  end if;
  raise notice 'TEST OK: デフォルトカテゴリ 6 件がシードされた';
end $$;

\echo '--- Test 2: 同じユーザーで二重作成は拒否 ---'

do $$
begin
  perform public.create_couple('りゅうすけ2');
  raise exception 'TEST FAILED: 二重作成が許可された';
exception when others then
  if sqlerrm like '%already in a couple%' then
    raise notice 'TEST OK: 期待通りの例外: %', sqlerrm;
  else
    raise;
  end if;
end $$;

\echo '--- Test 3: パートナーが招待トークンで join_couple できる ---'

insert into auth.users (id, email)
  values ('22222222-2222-2222-2222-222222222222', 'partner@example.com');

select invite_token from public.couples
  where id = (select couple_id from public.couple_members
                where user_id = '11111111-1111-1111-1111-111111111111') \gset

set app.current_user_id = '22222222-2222-2222-2222-222222222222';
select public.join_couple(:'invite_token'::uuid, 'パートナー') as joined_id \gset

do $$
declare v_count int;
begin
  select count(*) into v_count from public.couple_members
    where user_id = '22222222-2222-2222-2222-222222222222'
      and role = 'partner'
      and display_name = 'パートナー';
  if v_count <> 1 then
    raise exception 'TEST FAILED: partner not registered';
  end if;
  raise notice 'TEST OK: パートナーが招待で参加した';
end $$;

\echo '--- Test 4: 不正な招待トークンは拒否 ---'

insert into auth.users (id, email)
  values ('33333333-3333-3333-3333-333333333333', 'nobody@example.com');
set app.current_user_id = '33333333-3333-3333-3333-333333333333';

do $$
begin
  perform public.join_couple('99999999-9999-9999-9999-999999999999'::uuid, 'だれか');
  raise exception 'TEST FAILED: 不正トークンが受け入れられた';
exception when others then
  if sqlerrm like '%Invalid invite token%' then
    raise notice 'TEST OK: 期待通りの例外: %', sqlerrm;
  else
    raise;
  end if;
end $$;

\echo '--- Test 5: 既にカップルに所属している人は join できない ---'

set app.current_user_id = '22222222-2222-2222-2222-222222222222';
do $$
declare v_token uuid;
begin
  select invite_token into v_token from public.couples limit 1;
  perform public.join_couple(v_token, 'もう入ってる');
  raise exception 'TEST FAILED: 二重参加が許可された';
exception when others then
  if sqlerrm like '%already in a couple%' then
    raise notice 'TEST OK: 期待通りの例外: %', sqlerrm;
  else
    raise;
  end if;
end $$;

\echo ''
\echo '✓ All RPC tests passed'
