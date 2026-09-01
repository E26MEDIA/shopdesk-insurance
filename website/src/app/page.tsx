import { CtaSection } from "@/components/CtaSection";
import { DownloadSection } from "@/components/DownloadSection";
import { Features } from "@/components/Features";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { RequestForm } from "@/components/RequestForm";
import { UiShowcase } from "@/components/UiShowcase";
import { WhySection } from "@/components/WhySection";

export default function HomePage() {
  return (
    <>
      <Hero />
      <UiShowcase />
      <Features />
      <WhySection />
      <HowItWorks />
      <RequestForm />
      <DownloadSection />
      <CtaSection />
    </>
  );
}
