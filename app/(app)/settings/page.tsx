import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .single();
  if (!member) return null;

  const [{ data: couple }, { data: members }, { data: categories }] =
    await Promise.all([
      supabase
        .from("couples")
        .select("id, default_ratio, invite_token")
        .eq("id", member.couple_id)
        .single(),
      supabase
        .from("couple_members")
        .select("user_id, display_name, role")
        .eq("couple_id", member.couple_id),
      supabase
        .from("categories")
        .select("id, name, color, sort_order")
        .eq("couple_id", member.couple_id)
        .eq("archived", false)
        .order("sort_order"),
    ]);

  return (
    <SettingsClient
      currentUserId={user.id}
      couple={couple!}
      members={members ?? []}
      categories={categories ?? []}
    />
  );
}
