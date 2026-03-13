import { TerminalSquare } from "lucide-react";
import { SecurityHeaderChecker } from "@/components/security-header-checker";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground sm:px-8">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0),rgba(0,0,0,0.55))]" />
        <div className="absolute left-0 top-0 h-full w-full bg-[linear-gradient(rgba(16,185,129,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-0 h-16 animate-scanline bg-gradient-to-b from-emerald-300/5 to-transparent" />

      <section className="relative mx-auto max-w-6xl space-y-8">
        <header className="space-y-3 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-300">
            <TerminalSquare className="h-3.5 w-3.5" />
            Threat Surface Scanner
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-emerald-100 sm:text-5xl">
            Security Header Checker
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground sm:text-base">
            Instant HTTP security header audits for modern web applications. Identify missing protections, misconfigurations, and
            concrete hardening steps.
          </p>
        </header>

        <SecurityHeaderChecker />
      </section>
    </main>
  );
}
