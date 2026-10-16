import Faq from "@/components/Faq";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ReportsShowcase from "@/components/ReportsShowcase";
import Ticker from "@/components/Ticker";
import { Channel, FinalCta, HowItWorks, Offline, Pricing, Problem } from "@/components/sections";
import { faqs } from "@/lib/faqs";

// FAQPage structured data so the questions can surface in search results.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Home() {
  return (
    <>
      <Header />
      <main id="top">
        <Hero />
        <Ticker />
        <Problem />
        <HowItWorks />
        <ReportsShowcase />
        <Features />
        <Offline />
        <Pricing />
        <Channel />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
