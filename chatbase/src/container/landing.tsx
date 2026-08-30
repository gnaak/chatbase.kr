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
  /**
   * 랜딩에만 위젯을 띄운다. 대시보드에는 1:1 문의가 따로 있고, 버블이 우측 하단에
   * 남아 있으면 봇 편집 화면의 미리보기를 덮는다.
   *
   * 정리할 것이 셋이다. script 태그만 지우면 나머지 둘이 남는다:
   *  - script 태그
   *  - widget.js가 body에 직접 붙인 #chatbase-widget-host (버블 + 패널)
   *  - window.__chatbase_loaded — widget.js의 중복 실행 가드.
   *    이걸 안 내리면 랜딩으로 되돌아왔을 때 스크립트가 즉시 return해서 위젯이 안 뜬다.
   */
  useEffect(() => {
    const w = window as Window & { __chatbase_loaded?: boolean };
    const script = document.createElement("script");
    script.src = "https://chatbase.kr/widget.js";
    script.setAttribute("data-bot-id", "7Wno-wWPVQ-a02Sm");
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.getElementById("chatbase-widget-host")?.remove();
      w.__chatbase_loaded = false;
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
