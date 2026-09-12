import { useEffect } from "react";
import Nav from "@/component/landing/nav";
import Hero from "@/component/landing/hero";
import Features from "@/component/landing/features";
import HowItWorks from "@/component/landing/howItWorks";
import Pricing from "@/component/landing/pricing";
import Faq from "@/component/landing/faq";
// import CTA from "@/component/landing/cta";  // 아래 <CTA /> 참고
import Footer from "@/component/landing/footer";

/**
 * 랜딩 데모 봇의 slug. 비우면 위젯을 아예 안 띄운다.
 *
 * ⚠️ **DB를 다시 만들면 이 slug는 사라진다.** 봇을 새로 만들면 slug가 새로
 * 발급되므로 그 값으로 갈아끼워야 한다. 없는 slug로 두면 방문자가 버블을
 * 눌렀을 때 "봇이 존재하지 않습니다"를 보게 되는데, 그건 첫인상이 깨지는
 * 자리다 — 제품이 자기 사이트에서 안 도는 걸 보여주는 셈이다.
 *
 * 학습 자료는 `chatbase-knowledge.txt`에 있다.
 */
const DEMO_BOT_SLUG = "0rFgOK3XXZLMCF9p";

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
    if (!DEMO_BOT_SLUG) return;
    const w = window as Window & { __chatbase_loaded?: boolean };
    const script = document.createElement("script");
    script.src = "https://chatbase.kr/widget.js";
    script.setAttribute("data-bot-id", DEMO_BOT_SLUG);
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
