"use client";

import { motion } from "framer-motion";

const COLUMNS = [
  {
    title: "Saved",
    color: "rgba(255,255,255,0.08)",
    accent: "rgba(255,255,255,0.15)",
    cards: [
      { company: "Stripe", role: "Software Engineer", time: "2h ago" },
      { company: "Linear", role: "Frontend Engineer", time: "5h ago" },
    ],
  },
  {
    title: "Applied",
    color: "rgba(99,102,241,0.12)",
    accent: "rgba(99,102,241,0.4)",
    cards: [
      { company: "Vercel", role: "Product Engineer", time: "1d ago" },
      { company: "Notion", role: "Full Stack Eng.", time: "2d ago" },
    ],
  },
  {
    title: "Interview",
    color: "rgba(16,185,129,0.1)",
    accent: "rgba(16,185,129,0.4)",
    cards: [
      { company: "Figma", role: "SWE II", time: "3d ago" },
    ],
  },
];

export function KanbanMockup() {
  return (
    <div
      className="p-4 rounded-2xl"
      style={{
        background: "rgba(15,15,26,0.8)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 0 40px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-white">Applications</span>
        <span className="ml-auto text-xs text-white/30">5 active</span>
      </div>

      <div className="flex gap-3">
        {COLUMNS.map((col, ci) => (
          <div key={col.title} className="flex-1 min-w-[120px]">
            {/* Column header */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: col.accent }}
              />
              <span className="text-xs font-semibold text-white/50">{col.title}</span>
              <span className="text-xs text-white/25 ml-auto">{col.cards.length}</span>
            </div>

            {/* Cards */}
            <div className="space-y-2">
              {col.cards.map((card, i) => (
                <motion.div
                  key={card.company}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: ci * 0.15 + i * 0.1, duration: 0.35 }}
                  className="p-2.5 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{
                    background: col.color,
                    border: `1px solid ${col.accent}`,
                  }}
                >
                  <div className="text-xs font-semibold text-white truncate">
                    {card.company}
                  </div>
                  <div className="text-[10px] text-white/40 truncate mt-0.5">
                    {card.role}
                  </div>
                  <div className="text-[9px] text-white/25 mt-1.5">{card.time}</div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
