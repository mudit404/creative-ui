"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
  exact = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  exact?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-2.5 py-1.5 transition-colors ${
        active ? "bg-paper-2 text-ink" : "text-muted hover:bg-paper-2 hover:text-ink"
      } ${className}`}
    >
      {children}
    </Link>
  );
}
