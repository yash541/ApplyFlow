import { Metadata } from "next";
import { KanbanBoard } from "@/components/applications/KanbanBoard";

export const metadata: Metadata = { title: "Applications Pipeline" };

export default function ApplicationsPage() {
  return (
    <div className="h-full flex flex-col gap-5 animate-fade-in">
      <div className="shrink-0">
        <h1 className="text-headline-md font-display font-bold text-on-surface">Application Pipeline</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Track and manage every job application in one place.
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <KanbanBoard />
      </div>
    </div>
  );
}
