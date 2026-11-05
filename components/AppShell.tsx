"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { dayMonth } from "@/lib/dates";
import { useApp } from "./AppProvider";
import { NameEntry } from "./NameEntry";
import { Setup } from "./Setup";
import { ICONS, Icon, PapiBust } from "./ui";

const NAV = [
  { href: "/", label: "Today", icon: ICONS.today },
  { href: "/spending", label: "Spending", icon: ICONS.spending },
  { href: "/budgets", label: "Budgets", icon: ICONS.budgets },
  { href: "/insights", label: "Insights", icon: ICONS.insights },
  { href: "/papi", label: "Papi", icon: ICONS.papi },
];

export function AppShell({ children }: { children: ReactNode }) {
  const app = useApp();
  const path = usePathname();

  if (app.loadFailed) {
    return (
      <main className="welcome">
        <div className="welcome-card" role="alert">
          <PapiBust mood="worried" size={130} bg="var(--coral)" />
          <h1 className="welcome-title">Papi can’t reach your budget</h1>
          <p className="welcome-sub">Check your internet connection, then try again. Nothing was lost.</p>
          <button type="button" className="btn-solid btn-wide" onClick={app.retry}>
            Try again
          </button>
        </div>
      </main>
    );
  }
  if (!app.loaded) return <div className="splash" aria-busy="true" />;
  if (!app.data.profile) return <NameEntry />;
  if (!app.settings || !app.summary) return <Setup />;

  const dates = `${dayMonth(app.summary.period.start)} to ${dayMonth(app.summary.period.end)}`;
  const isOn = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand">
          <PapiBust mood="content" size={44} bg="var(--amber)" />
          <span className="wordmark">Purrse</span>
        </Link>
        <nav aria-label="Main" className="pillnav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isOn(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="dates">{dates}</p>
      </header>

      <main className="main">{children}</main>

      <nav aria-label="Main" className="phonenav">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isOn(n.href) ? "page" : undefined}>
            <Icon d={n.icon} />
            <span>{n.label}</span>
          </Link>
        ))}
      </nav>

      <div role="status" className="toast-region">
        {app.toast && (
          <div className="toast" key={app.toast.id}>
            <span>{app.toast.text}</span>
            {app.toast.undo && (
              <button type="button" onClick={app.toast.undo}>
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
