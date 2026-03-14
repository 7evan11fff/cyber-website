"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RootTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} id="main-content" tabIndex={-1} className="page-transition-shell">
      {children}
    </div>
  );
}
