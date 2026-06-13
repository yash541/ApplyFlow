"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Mic,
  Settings,
  Zap,
  ChevronRight,
  UserCircle,
  Search,
  CreditCard,
} from "lucide-react";
import { cn } from "@applyflow/ui";
import { GradientText } from "@applyflow/ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/jobs", label: "Query Jobs", icon: Search },
  { href: "/resume", label: "Resume Lab", icon: FileText },
  { href: "/applications", label: "Applications", icon: Briefcase },
  { href: "/interview", label: "Preparation", icon: Mic },
  { href: "/profile", label: "Autofill Profile", icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 flex flex-col h-full glass-panel border-r border-white/5">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <GradientText className="font-display font-bold text-title-md tracking-tight">
          ApplyFlow
        </GradientText>
      </div>

      <div className="h-px bg-white/5 mx-4" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "sidebar-item",
                  active && "active",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {active && (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="h-px bg-white/5 mx-4" />

      {/* Bottom */}
      <div className="px-2 py-4">
        <Link href="/settings">
          <span className={cn("sidebar-item", pathname.startsWith("/settings") && !pathname.startsWith("/settings/billing") && "active")}>
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </span>
        </Link>
        <Link href="/settings/billing">
          <span className={cn("sidebar-item", pathname.startsWith("/settings/billing") && "active")}>
            <CreditCard className="h-4 w-4 shrink-0" />
            <span>Billing</span>
          </span>
        </Link>

        {/* Extension promo */}
        <a
          href="https://chromewebstore.google.com/detail/applyflow-ai/mcfbemijiellcnldfimonigejmjhejpf"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 mx-1 p-3 rounded-xl border flex flex-col gap-2 group transition-all duration-200 hover:border-primary/40 hover:bg-primary/10"
          style={{ background: "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.2)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs flex-shrink-0">
              ⚡
            </div>
            <p className="text-label-sm font-semibold text-white/80 group-hover:text-white transition-colors">
              Chrome Extension
            </p>
          </div>
          <p className="text-[11px] text-on-surface-variant/50 leading-snug">
            AI autofill & match scores directly on LinkedIn & ATS portals.
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-white justify-center transition-all"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Add to Chrome — Free
          </div>
        </a>
      </div>
    </aside>
  );
}
