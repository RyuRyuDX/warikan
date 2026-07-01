-- ============================================================================
-- Security fix: couple_members_update_own の WITH CHECK 欠落を修正
-- ============================================================================
-- 旧ポリシーは `for update using (user_id = auth.uid())` のみで WITH CHECK 未指定。
-- Postgres は WITH CHECK 未指定時に USING と同じ式をフォールバック採用するため、
-- 更新後の行チェックが user_id しか見ず、認証ユーザーが supabase-js で
--   update couple_members set couple_id = '<別カップル>' where user_id = 自分
-- を実行すると成立してしまう（join_couple の「2人まで」ガードや role 制約を
-- RLS 経由の直接更新で回避し、別カップルのデータを閲覧できる）。
--
-- 対策: 更新可能なのは自分の display_name のみ。couple_id と role は
-- 現在値へ固定する WITH CHECK を追加する。
-- ============================================================================

-- 現在の role を返すヘルパー（SECURITY DEFINER で RLS を回避して参照）
create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.couple_members where user_id = auth.uid() limit 1
$$;

drop policy if exists "couple_members_update_own" on public.couple_members;

create policy "couple_members_update_own" on public.couple_members for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and couple_id = public.user_couple_id()
    and role = public.user_role()
  );

-- PostgREST にスキーマ再読込を通知
notify pgrst, 'reload schema';
