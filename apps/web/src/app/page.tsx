import {
  Navbar,
  HeroSection,
  SocialProofBar,
  FeaturesSection,
  HowItWorks,
  FeatureGrid,
  InstallSection,
  FinalCTA,
  Footer,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#050508", color: "white", scrollBehavior: "smooth" }}
    >
      <Navbar />
      <HeroSection />
      <SocialProofBar />
      <FeaturesSection />
      <HowItWorks />
      <FeatureGrid />
      <InstallSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
