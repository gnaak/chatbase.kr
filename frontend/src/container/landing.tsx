import Nav from "@/component/landing/nav";
import Hero from "@/component/landing/hero";
import Features from "@/component/landing/features";
import HowItWorks from "@/component/landing/howItWorks";
import Pricing from "@/component/landing/pricing";
import Faq from "@/component/landing/faq";
import CTA from "@/component/landing/cta";
import Footer from "@/component/landing/footer";

const Landing = () => {
  return (
    <div className="min-h-svh bg-bg text-text-main">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
