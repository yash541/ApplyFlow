import { Metadata } from "next";
import { GlassPanel, GradientText } from "@applyflow/ui";
import { BookOpen, Video, Code2, Brain, ExternalLink } from "lucide-react";

export const metadata: Metadata = { title: "Interview Preparation — ApplyFlow" };

const CATEGORIES = [
  {
    icon: Code2,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    title: "Data Structures & Algorithms",
    resources: [
      { label: "NeetCode 150", type: "Free", url: "https://neetcode.io/practice", desc: "Curated LeetCode list with video solutions" },
      { label: "LeetCode", type: "Free/Paid", url: "https://leetcode.com/problemset/", desc: "Industry standard practice platform" },
      { label: "Blind 75", type: "Free", url: "https://www.techinterviewhandbook.org/grind75", desc: "75 essential problems by ex-Facebook engineer" },
    ],
  },
  {
    icon: Brain,
    color: "text-secondary",
    bg: "bg-secondary/10",
    border: "border-secondary/20",
    title: "System Design",
    resources: [
      { label: "System Design Primer", type: "Free", url: "https://github.com/donnemartin/system-design-primer", desc: "Comprehensive GitHub repo — 260k+ stars" },
      { label: "ByteByteGo", type: "Free/Paid", url: "https://bytebytego.com", desc: "Visual system design explanations by Alex Xu" },
      { label: "Grokking System Design", type: "Paid", url: "https://www.designgurus.io/course/grokking-the-system-design-interview", desc: "Structured course with real interview patterns" },
    ],
  },
  {
    icon: Video,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    title: "YouTube Channels",
    resources: [
      { label: "NeetCode", type: "Free", url: "https://www.youtube.com/@NeetCode", desc: "Clear algorithm walkthroughs with code" },
      { label: "Tech With Tim", type: "Free", url: "https://www.youtube.com/@TechWithTim", desc: "Python-focused DSA and interview prep" },
      { label: "Clement Mihailescu", type: "Free", url: "https://www.youtube.com/@clem", desc: "AlgoExpert founder — mock interviews & tips" },
    ],
  },
  {
    icon: BookOpen,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    title: "Behavioral & Soft Skills",
    resources: [
      { label: "Tech Interview Handbook", type: "Free", url: "https://www.techinterviewhandbook.org/behavioral-interview/", desc: "STAR method, common questions, best answers" },
      { label: "Interview Warmup (Google)", type: "Free", url: "https://grow.google/certificates/interview-warmup/", desc: "Practice answering questions out loud with AI" },
      { label: "Exponent", type: "Free/Paid", url: "https://www.tryexponent.com/practice", desc: "Mock interviews for PM, SWE, data roles" },
    ],
  },
];

const BADGE: Record<string, string> = {
  Free: "bg-success/10 text-success border-success/20",
  "Free/Paid": "bg-primary/10 text-primary border-primary/20",
  Paid: "bg-warning/10 text-warning border-warning/20",
};

export default function InterviewPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-headline-md font-display font-bold text-on-surface">
          <GradientText>Interview</GradientText> Preparation
        </h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Curated resources to help you prepare — DSA, system design, behavioral, and more.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {CATEGORIES.map((cat) => (
          <GlassPanel key={cat.title} variant="card" className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`h-8 w-8 rounded-lg ${cat.bg} border ${cat.border} flex items-center justify-center`}>
                <cat.icon className={`h-4 w-4 ${cat.color}`} />
              </div>
              <h2 className="text-title-sm font-display font-semibold text-on-surface">
                {cat.title}
              </h2>
            </div>
            <div className="space-y-2.5">
              {cat.resources.map((r) => (
                <a
                  key={r.label}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-label-md font-semibold text-on-surface group-hover:text-primary transition-colors">
                        {r.label}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${BADGE[r.type]}`}>
                        {r.type}
                      </span>
                    </div>
                    <p className="text-label-sm text-on-surface-variant/60 leading-snug">
                      {r.desc}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-on-surface-variant/30 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                </a>
              ))}
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
