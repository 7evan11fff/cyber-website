import Link from "next/link";

type DashboardTab = "overview" | "trends";

export function DashboardTabs({ active }: { active: DashboardTab }) {
  const tabs = [
    { href: "/dashboard", label: "Overview", key: "overview" as const },
    { href: "/dashboard/trends", label: "Trends", key: "trends" as const }
  ];

  return (
    <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Dashboard navigation">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              isActive
                ? "border-sky-500/70 bg-sky-500/20 text-sky-100"
                : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-sky-500/60 hover:text-sky-200"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
