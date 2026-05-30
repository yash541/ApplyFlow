import { Metadata } from "next";
import { GradientText } from "@applyflow/ui";
import { ResumeLab } from "@/components/resume/ResumeLab";

export const metadata: Metadata = { title: "Resume Lab" };

export default function ResumePage() {
  return <ResumeLab />;
}
