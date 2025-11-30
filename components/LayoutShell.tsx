"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideHeader = pathname === "/login" || pathname === "/register" || pathname === "/reset-password";

  return (
    <>
      {!hideHeader && <Header />}
      <main>{children}</main>
    </>
  );
}