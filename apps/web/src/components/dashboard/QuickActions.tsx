"use client";

import Link from "next/link";
import { FileText, Briefcase, UserCircle, Wand2 } from "lucide-react";
import { GlassPanel } from "@applyflow/ui";

const ACTIONS = [
  {
    href: "/resume",
    icon: FileText,
    label: "Upload Resume",
    description: "Parse and store your base resume",
    color: "text-primary",
    bg: "bg-primary/10 hover:bg-primary/15",
    border: "border-primary/20",
  },
  {
    href: "/resume?action=tailor",
    icon: Wand2,
    label: "Tailor Resume",
    description: "Match to a job description",
    color: "text-secondary",
    bg: "bg-secondary/10 hover:bg-secondary/15",
    border: "border-secondary/20",
  },
  {
    href: "/applications",
    icon: Briefcase,
    label: "Track Application",
    description: "Add to your pipeline",
    color: "text-warning",
    bg: "bg-warning/10 hover:bg-warning/15",
    border: "border-warning/20",
  },
  {
    href: "/profile",
    icon: UserCircle,
    label: "Autofill Profile",
    description: "Save details for instant form fill",
    color: "text-success",
    bg: "bg-success/10 hover:bg-success/15",
    border: "border-success/20",
  },
];

export function QuickActions() {
  return (
    <GlassPanel variant="card" className="p-5">
      <h2 className="text-title-md font-display font-semibold text-on-surface mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((action) => (
          <Link key={action.href} href={action.href}>
            <div
              className={`flex items-start gap-3 p-4 rounded-xl border ${action.border} ${action.bg} transition-all duration-150 cursor-pointer`}
            >
              <action.icon className={`h-5 w-5 ${action.color} shrink-0 mt-0.5`} />
              <div>
                <p className="text-label-md font-semibold text-on-surface">
                  {action.label}
                </p>
                <p className="text-label-sm text-on-surface-variant/60 mt-0.5">
                  {action.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </GlassPanel>
  );
}
