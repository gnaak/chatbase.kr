import { Link } from "react-router-dom";

import Button from "@shared/ui/button";

/**
 * llm.chatbase.kr 임시 랜딩.
 *
 * AEO 진단 엔진(`backend/module/aeo/`)이 붙기 전까지 자리만 잡아둔다.
 * 문의는 챗봇 쪽과 같은 창구(`/support`)를 쓴다 — 계정과 문의가 하나이기 때문.
 */
const LlmLanding = () => (
  <div className="min-h-svh bg-bg text-text-main flex items-center justify-center px-6">
    <div className="max-w-xl text-center">
      <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-4">
        llm.chatbase.kr
      </p>
      <h1 className="text-[32px] md:text-[42px] font-semibold tracking-heading leading-tight">
        AI가 찾는 회사가 되도록
      </h1>
      <p className="mt-4 text-[15px] text-text-sub leading-relaxed">
        ChatGPT · Claude · Perplexity는 자바스크립트를 실행하지 않습니다.
        요즘 만든 사이트일수록 AI 답변엔진에는 빈 페이지로 보입니다.
        무엇이 보이고 무엇이 안 보이는지부터 진단해 드립니다.
      </p>
      <div className="mt-8 flex items-center justify-center gap-2">
        <Link to="/support?category=partnership">
          <Button size="lg" pill>
            진단 문의하기
          </Button>
        </Link>
        <a href="https://chatbase.kr">
          <Button size="lg" pill variant="secondary">
            챗봇 서비스 보기
          </Button>
        </a>
      </div>
    </div>
  </div>
);

export default LlmLanding;
