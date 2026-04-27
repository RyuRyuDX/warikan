-- ============================================================================
-- ローカル検証用スタブ: Supabase の auth スキーマを最小限模倣する。
-- 本番 Supabase では auth スキーマが既に存在するため、これは適用しない。
-- run_tests.sh からのみ使われる。
-- ============================================================================

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

-- セッション変数 app.current_user_id を auth.uid() の戻り値として使う
create or replace function auth.uid()
returns uuid
language plpgsql
stable
as $$
begin
  return nullif(current_setting('app.current_user_id', true), '')::uuid;
exception when others then
  return null;
end;
$$;
