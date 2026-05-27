import { Metadata } from "next";
import { MasterProfileForm } from "@/components/profile/MasterProfileForm";

export const metadata: Metadata = { title: "Autofill Profile — ApplyFlow" };

export default function ProfilePage() {
  return <MasterProfileForm />;
}
