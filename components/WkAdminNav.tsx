'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

const WK_ADMIN_LINKS = [
  { href: "/wk-2026/predictions", label: "User predictions" },
  { href: "/wk-2026/admin", label: "Groepen" },
  { href: "/wk-2026", label: "Pots indelen" },
  { href: "/wk-2026/pots", label: "Pots overzicht" },
  { href: "/wk-2026/admin/knockout", label: "Knockout" },
  { href: "/wk-2026/admin/standings", label: "Admin predictions" },
];

export function WkAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-3">
      {WK_ADMIN_LINKS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-4 py-2 font-semibold transition-colors ${
              isActive
                ? "bg-[#ff9900] text-white"
                : "bg-white text-[#9a4d00] hover:bg-[#fff0d9]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
