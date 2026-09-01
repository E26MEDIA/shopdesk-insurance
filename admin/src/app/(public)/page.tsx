import { CtaSection } from "@/components/marketing/CtaSection";
import { DownloadSection } from "@/components/marketing/DownloadSection";
import { Features } from "@/components/marketing/Features";
import { Hero } from "@/components/marketing/Hero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { RequestForm } from "@/components/marketing/RequestForm";
import { UiShowcase } from "@/components/marketing/UiShowcase";
import { WhySection } from "@/components/marketing/WhySection";

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
