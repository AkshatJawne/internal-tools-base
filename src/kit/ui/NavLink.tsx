"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] ${active ? "bg-white font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:bg-white/70 hover:text-ink"}`}
    >
      {children}
    </Link>
  );
}
