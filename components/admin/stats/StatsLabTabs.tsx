"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/stats-lab", label: "Workspace" },
  { href: "/admin/stats-ideas", label: "Ideas" },
  { href: "/admin/stats-results", label: "Results" },
];

export function StatsLabTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
