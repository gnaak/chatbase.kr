import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";

import Nav from "@/component/landing/nav";
import Footer from "@/component/landing/footer";
import NotFoundPage from "@/container/notfound";
import Button from "@/ui/button";
import { INDUSTRIES, industryBySlug, planByName } from "@/constants/industries";

/**
 * 업종별 공개 페이지 — `/for/:slug`.
 *
 * ## 왜 이런 모양인가
 *
 * 답변엔진(AI Overviews · Copilot)은 페이지를 **요약**하는 게 아니라 **답이 되는
 * 문장을 찾아 추출**한다. 그래서 레이아웃이 곧 최적화다:
 *
 *   1. `<h1>` 바로 아래 **직답 한 문장** — 맥락에 기대지 않고 그 자체로 완결된 사실
 *   2. 그 다음 **표** — 엔진이 표를 구조화된 사실로 안정적으로 파싱한다
 *   3. 각 문단이 주어·대상·조건을 자체 보유 (추출돼도 의미가 남는다)
 *
 * ## 한 컴포넌트가 네 페이지를 그린다
 *
 * 라우트는 `/for/:slug` 하나지만 프리렌더는 `prerender.tsx` ROUTES 의 4개를 각각
 * 정적 HTML 로 굽는다. 크롤러는 `/for/academy` 에서 학원 페이지가 통째로 들어 있는
 * HTML 을 받는다 — JS 를 안 돌려도 된다.
 *
 * ## FAQ 는 업종마다 달라야 한다
 *
 * 같은 Q&A 를 여러 URL 에 `FAQPage` 로 중복 선언하면 스팸 신호가 된다.
 * `constants/industries.ts` 의 `faq` 는 랜딩 FAQ 와 질문이 겹치지 않게 짜여 있다.
 */
const IndustryPage = () => {
  const { slug } = useParams();
  const industry = industryBySlug(slug);

  // 없는 업종이면 404 화면을 그대로 그린다. 리다이렉트하면 크롤러가 홈으로 흡수된다
  if (!industry) return <NotFoundPage />;

  const plan = planByName(industry.recommendedPlan);
  const others = INDUSTRIES.filter((i) => i.slug !== industry.slug);

  return (
    <div className="min-h-svh bg-bg text-text-main">
      <Nav />

      <main className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-3">
          {industry.name}
        </p>

        <h1 className="text-[32px] md:text-[44px] font-semibold tracking-heading leading-tight">
          {industry.name} 챗봇
        </h1>

        {/* 직답 — 답변엔진이 최상단에서 찾는 문장이다 */}
        <p className="mt-5 text-[17px] md:text-[19px] leading-relaxed text-text-main">
          {industry.answer}
        </p>

        {/* ── 핵심 사실 표 ─────────────────────────────── */}
        <table className="mt-10 w-full text-[14px] border-collapse">
          <caption className="sr-only">
            {industry.name} 챗봇 도입 요약
          </caption>
          <tbody>
            <tr className="border-t border-line">
              <th
                scope="row"
                className="py-3 pr-6 text-left align-top font-medium text-text-sub whitespace-nowrap"
              >
                설치 방법
              </th>
              <td className="py-3 text-text-main">
                홈페이지에 <code className="font-mono text-[13px]">script</code> 태그 한 줄,
                또는 인쇄한 QR 코드
              </td>
            </tr>
            <tr className="border-t border-line">
              <th
                scope="row"
                className="py-3 pr-6 text-left align-top font-medium text-text-sub whitespace-nowrap"
              >
                답변 근거
              </th>
              <td className="py-3 text-text-main">
                직접 등록한 자료만. 자료에 없는 질문에는 미리 정한 안내를 내보냅니다
              </td>
            </tr>
            <tr className="border-t border-line">
              <th
                scope="row"
                className="py-3 pr-6 text-left align-top font-medium text-text-sub whitespace-nowrap"
              >
                권장 플랜
              </th>
              <td className="py-3 text-text-main">
                {plan ? (
                  <>
                    {plan.name} · {plan.price}
                    {plan.unit ? ` ${plan.unit.trim()}` : ""}
                  </>
                ) : (
                  industry.recommendedPlan
                )}
              </td>
            </tr>
            <tr className="border-t border-b border-line">
              <th
                scope="row"
                className="py-3 pr-6 text-left align-top font-medium text-text-sub whitespace-nowrap"
              >
                시작 비용
              </th>
              <td className="py-3 text-text-main">
                무료 플랜으로 먼저 써볼 수 있습니다. API 키 없이 바로 시작합니다
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-[13px] text-text-sub leading-relaxed">
          {industry.planReason}
        </p>

        {/* ── 무엇을 넣나 ──────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-[22px] md:text-[26px] font-semibold tracking-heading">
            {industry.name}에서 넣어두는 자료
          </h2>
          <p className="mt-3 text-[14px] text-text-sub leading-relaxed">
            대시보드에 텍스트로 넣거나, 파일을 올리거나, 웹페이지 주소를 넣어 내용을
            읽어올 수 있습니다. 넣은 자료 안에서만 답하므로 지어내지 않습니다.
          </p>
          <ul className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {industry.materials.map((m) => (
              <li key={m} className="flex items-start gap-2.5 text-[14px]">
                <Check className="w-4 h-4 mt-0.5 shrink-0 text-text-sub" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── 어떤 질문에 답하나 ───────────────────────── */}
        <section className="mt-14">
          <h2 className="text-[22px] md:text-[26px] font-semibold tracking-heading">
            이런 질문에 답하도록 설정할 수 있습니다
          </h2>
          <ul className="mt-5 flex flex-col gap-2">
            {industry.questions.map((q) => (
              <li
                key={q}
                className="rounded-lg border border-line px-4 py-3 text-[14px] text-text-main"
              >
                “{q}”
              </li>
            ))}
          </ul>
        </section>

        {/* ── FAQ ──────────────────────────────────────── */}
        <section className="mt-14">
          <h2 className="text-[22px] md:text-[26px] font-semibold tracking-heading">
            {industry.name} 도입 전 자주 묻는 것
          </h2>
          <dl className="mt-6 flex flex-col gap-7">
            {industry.faq.map((item) => (
              <div key={item.q}>
                <dt className="text-[15px] font-semibold">{item.q}</dt>
                <dd className="mt-2 text-[14px] text-text-sub leading-relaxed">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── CTA ──────────────────────────────────────── */}
        <section className="mt-16 rounded-xl border border-line p-7 md:p-9">
          <h2 className="text-[20px] md:text-[24px] font-semibold tracking-heading">
            무료로 먼저 만들어 보세요
          </h2>
          <p className="mt-2.5 text-[14px] text-text-sub leading-relaxed">
            가입하면 챗봇 1개를 만들 수 있고 월 100건까지 무료입니다. GPT 사용료는
            chatbase.kr가 부담하므로 API 키를 따로 발급받지 않아도 됩니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/signup">
              <Button pill rightIcon={<ArrowRight className="w-4 h-4" />}>
                무료로 시작
              </Button>
            </Link>
            <Link to="/support">
              <Button pill variant="secondary">
                도입 문의
              </Button>
            </Link>
          </div>
        </section>

        {/* ── 다른 업종 (내부 링크) ────────────────────── */}
        <nav className="mt-14 pt-7 border-t border-line" aria-label="다른 업종">
          <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-3">
            다른 업종
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  to={`/for/${o.slug}`}
                  className="text-[14px] text-text-sub hover:text-text-main transition-colors"
                >
                  {o.name} 챗봇
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          1차 출처 선언. 생성엔진은 "이 숫자가 어디서 시작됐나"를 추적하므로,
          우리가 원출처인 항목(요금·한도·기능)을 페이지가 직접 말하게 둔다.
        */}
        <p className="mt-10 text-[12px] text-text-sub leading-relaxed">
          이 페이지의 요금·한도·기능은 chatbase.kr가 직접 운영하는 서비스의 기준입니다.
          최신 요금은 <Link to="/#pricing" className="underline hover:text-text-main">요금제</Link>에서
          확인하실 수 있습니다.
        </p>
      </main>

      <Footer />
    </div>
  );
};

export default IndustryPage;
