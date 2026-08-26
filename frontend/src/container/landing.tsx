import { useEffect } from "react";
import Nav from "@/component/landing/nav";
import Hero from "@/component/landing/hero";
import Features from "@/component/landing/features";
import HowItWorks from "@/component/landing/howItWorks";
import Pricing from "@/component/landing/pricing";
import Faq from "@/component/landing/faq";
// import CTA from "@/component/landing/cta";  // 아래 <CTA /> 참고
import Footer from "@/component/landing/footer";

const Landing = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://chatbase.kr/widget.js";
    script.setAttribute("data-bot-id", "keF3kZxTvTmHe9nl");
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-svh bg-bg text-text-main">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Faq />
        {/* CTA("오늘 만들어, 오늘 배포") 잠시 내려둠 — Hero·Pricing에 이미 가입 CTA가
            있어 중복이었고, 풀스크린 섹션 하나를 줄여 랜딩을 짧게 가져간다.
            되살리려면 이 줄과 위 import 주석만 해제하면 된다. */}
      </main>
      <Footer />
    </div>
  );
};

export default Landing;
