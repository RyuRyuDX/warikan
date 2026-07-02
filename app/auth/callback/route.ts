import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// オープンリダイレクト対策: 同一オリジンの相対パスのみ許可する。
// 先頭が単一の "/" のものだけ通し、"//"（プロトコル相対）や "/\" は拒否する。
function safeNext(next: string): string {
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return "/calendar";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next") ?? "/calendar");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
