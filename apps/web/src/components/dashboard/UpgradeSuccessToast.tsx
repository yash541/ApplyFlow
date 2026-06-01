"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

export function UpgradeSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setVisible(true);
      // Remove the query param from the URL without a page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      router.replace(url.pathname + (url.search || ""), { scroll: false });

      // Auto-dismiss after 6 seconds
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, [searchParams, router]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 animate-fade-in">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
      <div className="flex-1">
        <p className="text-label-sm font-semibold text-emerald-300">
          Welcome to ApplyFlow Pro!
        </p>
        <p className="text-label-xs text-emerald-400/70">
          Your plan has been upgraded. All limits are now removed.
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="rounded p-1 text-emerald-400/60 hover:text-emerald-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
