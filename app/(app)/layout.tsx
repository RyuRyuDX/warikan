import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TabLink from "./tab-link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/onboarding");

  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom">
        <div className="flex justify-around py-2 max-w-md mx-auto">
          <TabLink href="/calendar" label="カレンダー" icon="📅" />
          <TabLink href="/summary" label="サマリー" icon="📊" />
          <TabLink href="/settings" label="設定" icon="⚙️" />
        </div>
      </nav>
    </div>
  );
}
