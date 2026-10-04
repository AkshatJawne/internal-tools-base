"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"}`}>
      {children}
    </Link>
  );
}
