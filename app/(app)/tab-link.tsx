"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLinkStatus } from "next/link";

// タップ時に即座にアクティブ表示し、ナビゲーション中は subtle なローディング感を出す。
// 体感を「押した瞬間反応している」状態にするためのコンポーネント。
function TabIndicator({
  icon,
  label,
  active,
}: {
  icon: string;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  const highlight = active || pending;
  return (
    <span
      className={`flex flex-col items-center gap-1 px-6 py-1 transition-colors ${
        highlight ? "text-primary" : "text-gray-500 dark:text-zinc-400"
      }`}
    >
      <span className={`text-lg ${pending ? "opacity-60" : ""}`}>{icon}</span>
      <span className="text-[10px] font-semibold">{label}</span>
    </span>
  );
}

export default function TabLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} prefetch>
      <TabIndicator icon={icon} label={label} active={active} />
    </Link>
  );
}
