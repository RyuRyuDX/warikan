import { createClient } from "@/lib/supabase/server";
import CalendarClient from "./calendar-client";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
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
        .select("default_ratio, invite_token")
        .eq("id", member.couple_id)
        .single(),
      supabase
        .from("couple_members")
        .select("user_id, display_name, role")
        .eq("couple_id", member.couple_id),
      supabase
        .from("categories")
        .select("id, name, color")
        .eq("couple_id", member.couple_id)
        .eq("archived", false)
        .order("sort_order"),
    ]);

  return (
    <CalendarClient
      currentUserId={user.id}
      coupleId={member.couple_id}
      defaultRatio={couple?.default_ratio ?? 0.7}
      members={members ?? []}
      categories={categories ?? []}
    />
  );
}
