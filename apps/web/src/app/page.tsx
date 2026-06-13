import {
  Navbar,
  HeroSection,
  SocialProofBar,
  FeaturesSection,
  HowItWorks,
  FeatureGrid,
  PricingSection,
  InstallSection,
  FinalCTA,
  Footer,
} from "@/components/landing";
import { DemoSection } from "@/components/landing/DemoSection";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#050508", color: "white", scrollBehavior: "smooth" }}
    >
      <Navbar />
      <HeroSection />
      <SocialProofBar />
      <DemoSection />
      <FeaturesSection />
      <HowItWorks />
      <FeatureGrid />
      <PricingSection />
      <InstallSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
