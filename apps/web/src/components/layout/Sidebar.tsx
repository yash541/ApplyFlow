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
        <div className="mt-3 mx-1 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <p className="text-label-sm text-primary/80 font-medium mb-1">
            Chrome Extension
          </p>
          <p className="text-label-sm text-on-surface-variant/60 leading-snug">
            Auto-fill & match jobs on LinkedIn
          </p>
        </div>
      </div>
    </aside>
  );
}
