/**
 * 프리렌더 진입점 — Node 에서만 돈다. 클라이언트 번들에는 들어가지 않는다.
 *
 * ## 왜 필요한가
 *
 * chatbase.kr 은 React SPA 라 크롤러가 받는 `<body>` 의 텍스트가 **0자**였다.
 * Googlebot 은 JS 를 실행해 주지만 **GPTBot · OAI-SearchBot · ClaudeBot 은 하지 않는다.**
 * "사이트가 있는 곳"이 아니라 **"사이트가 읽히는 곳"**이 AI 답변에 인용된다.
 *
 * ## 여기서 만드는 것 둘
 *
 * 1. 공개 라우트의 렌더 결과 HTML → `dist/<라우트>/index.html` 의 `#root` 안
 * 2. JSON-LD 구조화 데이터        → 같은 파일의 `<head>` 안
 *
 * 실행은 `scripts/prerender.mjs` 가 하고 `npm run build` 에 물려 있다.
 *
 * ## 데이터 원본
 *
 * FAQ 는 `component/landing/faq.tsx` 의 `FAQ_ITEMS`, 요금은 `types/plan.ts` 의
 * `PLANS` 를 그대로 읽는다. **구조화 데이터용으로 따로 적어두지 않는다** —
 * 두 벌이 되면 가격을 고칠 때 한쪽만 고치고, 그러면 AI 가 틀린 가격을 답한다.
 */
import type { ReactNode } from "react";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";

import AppShell from "@/app";
import publicRoutes from "@/publicRoutes";
import { FAQ_ITEMS } from "@/component/landing/faq";
import { ENTERPRISE, PLANS } from "@/types/plan";
import { BUSINESS_INFO_ROWS, SHOW_BUSINESS_INFO } from "@/constants/company";

const ORIGIN = "https://chatbase.kr";

/* ── 프리렌더 대상 ──────────────────────────────────────────── */

export interface PrerenderRoute {
  /** 라우터 경로 */
  path: string;
  /** `dist/` 기준 출력 파일 경로 */
  out: string;
  title: string;
  description: string;
}

/**
 * 공개 라우트만 넣는다. 대시보드·어드민·임베드는 로그인 뒤 화면이라 의미가 없고,
 * `/support/:token` 은 남의 문의가 색인되면 안 된다(`public/robots.txt`).
 *
 * ⚠️ `public/sitemap.xml` 과 목록이 같아야 한다. 어긋나면 sitemap 에는 있는데
 *    크롤러에게는 빈 페이지인 URL 이 생긴다.
 */
export const ROUTES: PrerenderRoute[] = [
  {
    path: "/",
    out: "index.html",
    title: "chatbase.kr — 5분이면 끝나는 AI 챗봇",
    description:
      "홈페이지에는 코드 한 줄, 매장에는 QR 한 장으로 내거는 AI 챗봇. 홈페이지가 없어도 되고, 외국인 손님에게는 한·영·일·중으로 답합니다. GPT 사용료는 저희가 부담해 API 키 없이 바로 시작하고, 내 키를 등록하면 모델 선택과 무제한 대화가 열립니다.",
  },
  {
    path: "/support",
    out: "support/index.html",
    title: "문의하기 — chatbase.kr",
    description:
      "chatbase.kr 도입·기능·결제 문의. 영업일 기준 5일 이내에 답변드립니다. 사내 전용 챗봇 구축(ENTERPRISE) 상담도 이곳에서 받습니다.",
  },
  {
    path: "/terms",
    out: "terms/index.html",
    title: "이용약관 — chatbase.kr",
    description:
      "chatbase.kr 챗봇 임베드 SaaS 이용약관. 회원의 권리·의무, 회사 제공 API 키와 회원 등록 키(BYOK)의 사용 조건, 서비스 제공 범위를 규정합니다.",
  },
  {
    path: "/privacy",
    out: "privacy/index.html",
    title: "개인정보처리방침 — chatbase.kr",
    description:
      "chatbase.kr 이 수집하는 개인정보 항목과 이용 목적, 보관 기간, 파기 절차. 등록된 API 키는 Fernet(AES-128) 암호화로 저장되며 탈퇴 시 즉시 파기됩니다.",
  },
];

/* ── 라우트 렌더 ────────────────────────────────────────────── */

/**
 * 라우트 하나를 HTML 문자열로. `#root` 안에 그대로 들어간다.
 *
 * `renderToString` 은 `useEffect` · `useLayoutEffect` 를 실행하지 않는다.
 * 그래서 위젯 스크립트 주입(landing.tsx)도, 쿠키에서 로그인 정보를 읽는
 * AuthProvider 도 서버에서는 돌지 않는다 — 크롤러는 **로그아웃 상태의 화면**을 본다.
 * 공개 페이지라 그게 맞다.
 *
 * `@/routes` 가 아니라 `@/publicRoutes` 를 쓴다 — 전자는 대시보드 컨테이너를 전부
 * 끌고 오고 그중 일부가 모듈 스코프에서 `window` 를 읽어 Node 에서 죽는다.
 */
export const renderRoute = (path: string): string =>
  renderToString(
    <AppShell router={(routes) => <StaticRouter location={path}>{routes}</StaticRouter>}>
      {publicRoutes()}
    </AppShell>,
  );

/* ── JSON-LD ────────────────────────────────────────────────── */

/**
 * JSX 답변을 평문으로. `FAQPage` 의 `acceptedAnswer.text` 는 마크업이 아니라
 * 사람이 읽는 문장이어야 한다.
 *
 * 태그를 먼저 벗기고 엔티티를 나중에 푼다. 순서를 바꾸면 FAQ 7번의 `<code>` 안에
 * 이스케이프돼 있는 `&lt;script&gt;` 가 진짜 태그로 되살아나 통째로 지워진다.
 *
 * ## 태그를 두 갈래로 나눠 지운다
 *
 * 전부 공백으로 바꾸면 `저희가 <strong>부담</strong>하므로` 가
 * **"저희가 부담 하므로"** 가 된다. 강조를 넣고 빼는 것만으로 인용되는 문장이
 * 바뀌면 안 되므로, 글자 사이에 끼는 인라인 태그는 **흔적 없이** 지운다.
 *
 * 반대로 블록과 링크는 공백이 있어야 한다. FAQ 2번의 키 발급 버튼 세 개가
 * `</a><a>` 로 맞붙어 있어서, 안 띄우면 "OpenAI 키 발급Anthropic 키 발급" 이 된다.
 * `<code>` 도 인라인이지만 같은 쪽에 둔다 — FAQ 7번의 임베드 예시가 앞뒤 문장에
 * 들러붙어 "발급됩니다:<script …></script>이 한 줄을" 이 되기 때문이다.
 */
const plainText = (node: ReactNode): string =>
  renderToStaticMarkup(<StaticRouter location="/">{node}</StaticRouter>)
    .replace(/<\/?(strong|b|em|i|u|span|small|mark)\b[^>]*>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    // 블록 태그를 공백으로 바꾼 자리가 구두점 바로 앞이면 "없어집니다 ." 가 된다
    .replace(/\s+([,.!?)\]])/g, "$1")
    .trim();

/** "₩19,000" → 19000 */
const won = (price: string): number => Number(price.replace(/[^0-9]/g, ""));

const organization = {
  "@type": "Organization",
  "@id": `${ORIGIN}/#organization`,
  name: "챗베이스코리아",
  /**
   * 이름이 겹친다. `chatbase` 단독 질문은 미국의 chatbase.co 가 가져가고,
   * 크롤로는 못 뒤집는다(학습 데이터에 이미 두껍게 박혀 있다).
   * 그래서 **안 겹치는 이름을 하나 만들어 그걸 엔티티로 키운다.**
   */
  alternateName: ["chatbase.kr", "챗베이스", "챗베이스 코리아"],
  disambiguatingDescription:
    "대한민국에서 운영되는 챗봇 SaaS 로, 미국의 Chatbase(chatbase.co) 및 과거 Google 의 챗봇 분석 도구 Chatbase 와는 무관한 별개의 서비스입니다. 도메인은 chatbase.kr 입니다.",
  url: ORIGIN,
  /**
   * 둘은 **용도가 달라 비율도 다르다.** 같은 파일을 쓰면 한쪽이 반드시 틀린다.
   *
   *   logo   구글이 **정사각형**을 기대한다(지식 패널·검색 결과의 브랜드 아이콘)
   *   image  대표 이미지. 링크 카드와 같은 1.91:1
   *
   * 둘 다 `scripts/og-image.mjs` 가 만든다.
   */
  logo: `${ORIGIN}/logo-512.png`,
  image: `${ORIGIN}/og-image-v2.png`,
  description:
    "홈페이지에 코드 한 줄로 붙이거나 QR 코드로 내거는 AI 챗봇 SaaS. 홈페이지가 없는 매장·숙소도 인쇄한 QR 한 장으로 시작할 수 있고, 외국인 방문자에게는 한국어·영어·일본어·중국어로 응대합니다. OpenAI(GPT) 사용료는 chatbase.kr가 부담하므로 API 키 없이 바로 시작할 수 있고, 회원이 직접 발급한 API 키를 등록하면(BYOK) 모델 선택·파일 학습·웹 검색이 열리고 월 대화 건수 제한이 없어집니다. Anthropic(Claude)과 Google(Gemini) 모델은 본인 키가 필요합니다.",
  areaServed: { "@type": "Country", name: "대한민국" },
  knowsLanguage: ["ko", "en"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${ORIGIN}/support`,
      availableLanguage: ["Korean"],
    },
  ],
};

const website = {
  "@type": "WebSite",
  "@id": `${ORIGIN}/#website`,
  url: ORIGIN,
  name: "chatbase.kr",
  inLanguage: "ko",
  publisher: { "@id": `${ORIGIN}/#organization` },
};

/**
 * 파는 기능 목록.
 *
 * ⚠️ 요금·한도와 달리 **이 배열만은 손으로 쓴다.** `PLANS` 는 플랜별 차이를 담지
 * 상품 전체가 무엇을 하는지는 담지 않기 때문이다. 기능을 추가하고 여기를 빼먹으면
 * "AI 가 아는 우리"에 신상품이 없는 상태가 된다.
 * (실제로 QR·다국어가 한동안 빠져 있었다 — 카드는 팔고 있는데 이유는 없었다.)
 *
 * 읽는 곳이 둘이다: `SoftwareApplication.featureList` 와 `llms.txt`.
 */
const FEATURE_LIST = [
  "코드 한 줄 위젯 임베드 (script · iframe)",
  "QR 코드 — 홈페이지 없이 인쇄물로 챗봇 배포",
  "다국어 응대 — 한국어 · 영어 · 일본어 · 중국어",
  "인사말 · 자주 묻는 질문 자동 번역 (DeepL)",
  "API 키 없이 시작 — OpenAI(GPT) 사용료 무료 제공",
  "BYOK — 내 OpenAI · Anthropic · Google 키 등록 시 모델 선택 · 무제한 대화",
  "텍스트 · 파일 · 웹페이지 학습",
  "자주 묻는 질문 즉답 버튼",
  "카카오톡 채널 연동 (오픈빌더 스킬 서버)",
  "대화 기록 조회 · 통계",
  "웹 검색 (전 플랜 공통)",
];

const softwareApplication = {
  "@type": "SoftwareApplication",
  "@id": `${ORIGIN}/#software`,
  name: "chatbase.kr",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "AI 챗봇 · 고객 응대 자동화",
  operatingSystem: "Web",
  url: ORIGIN,
  inLanguage: "ko",
  publisher: { "@id": `${ORIGIN}/#organization` },
  featureList: FEATURE_LIST,
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "KRW",
    lowPrice: 0,
    highPrice: Math.max(...PLANS.map((p) => won(p.price))),
    offerCount: PLANS.length,
    offers: PLANS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.tagline,
      price: won(plan.price),
      priceCurrency: "KRW",
      url: `${ORIGIN}/#pricing`,
      /** 무료 플랜에는 과금 주기가 없다 */
      ...(won(plan.price) > 0
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: won(plan.price),
              priceCurrency: "KRW",
              valueAddedTaxIncluded: false,
              billingDuration: 1,
              billingIncrement: 1,
              unitCode: "MON",
            },
          }
        : {}),
      itemOffered: {
        "@type": "Service",
        name: `chatbase.kr ${plan.name}`,
        description: plan.features
          .filter((f) => !f.off)
          .map((f) => (f.note ? `${f.label}(${f.note})` : f.label))
          .join(", "),
      },
    })),
  },
};

const faqPage = () => ({
  "@type": "FAQPage",
  "@id": `${ORIGIN}/#faq`,
  inLanguage: "ko",
  isPartOf: { "@id": `${ORIGIN}/#website` },
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: plainText(item.a) },
  })),
});

const webPage = (route: PrerenderRoute, type: string) => ({
  "@type": type,
  "@id": `${ORIGIN}${route.path}#webpage`,
  url: `${ORIGIN}${route.path}`,
  name: route.title,
  description: route.description,
  inLanguage: "ko",
  isPartOf: { "@id": `${ORIGIN}/#website` },
  about: { "@id": `${ORIGIN}/#organization` },
});

/**
 * 라우트별 구조화 데이터. `@graph` 하나로 묶어 `<head>` 에 넣는다.
 *
 * ⚠️ `FAQPage` 는 랜딩에만 붙인다. 같은 Q&A 를 여러 URL 에 중복으로 선언하면
 *    스팸 신호가 된다.
 */
export const structuredData = (path: string): object => {
  const route = ROUTES.find((r) => r.path === path)!;

  const graph: object[] = [organization, website];

  if (path === "/") {
    graph.push(softwareApplication, faqPage());
  } else {
    graph.push(
      webPage(route, path === "/support" ? "ContactPage" : "WebPage"),
    );
  }

  return { "@context": "https://schema.org", "@graph": graph };
};

/* ── llms.txt ───────────────────────────────────────────────── */

/**
 * `dist/llms.txt` 본문.
 *
 * ## JSON-LD 가 이미 있는데 왜 또 만드나
 *
 * 읽는 쪽이 다르다. JSON-LD 는 **검색엔진의 파서**가 `<head>` 에서 긁어가고,
 * `llms.txt` 는 **답변을 쓰는 LLM** 이 사람 글처럼 읽는다. 전자는 스키마에
 * 맞는 필드만 가져가므로 "왜 우리를 골라야 하는가" 같은 문장이 들어갈 자리가
 * 없고, 후자는 그게 본론이다.
 *
 * ## 손으로 쓰지 않는 이유
 *
 * `public/llms.txt` 로 두면 요금·기능·FAQ 가 **두 벌**이 된다. 가격을 고칠 때
 * 한쪽만 고치게 되고, 그러면 AI 가 틀린 가격을 답한다 — 이 파일 맨 위가
 * JSON-LD 에 대해 경고해둔 것과 같은 함정이라 같은 방식으로 피한다.
 * 화면에 보이는 것과 어긋날 수 없는 구조가 요점이다.
 *
 * ⚠️ 따라서 `npm run build:spa`(프리렌더 생략) 로 빌드하면 `llms.txt` 가 없다.
 *    디버깅용 스크립트라 그대로 둔다.
 */
export const llmsTxt = (): string => {
  const plan = (p: (typeof PLANS)[number]): string => {
    const head = `### ${p.name} — ${p.price}${p.unit ? ` ${p.unit.trim()}` : ""}`;
    // 구분자가 `·` 면 안 된다 — `bestFor` 자체가 "학원 · 병원 · 공방" 이라
    // 어디까지가 대상이고 어디부터가 소개인지 경계가 사라진다
    const who = `누구를 위한 것: ${p.bestFor} — ${p.tagline}`;
    const items = p.features.map((f) => {
      const note = f.note ? ` (${f.note})` : "";
      return `- ${f.label}${note}${f.off ? " — 제공하지 않음" : ""}`;
    });
    return [head, "", who, "", ...items].join("\n");
  };

  const faq = FAQ_ITEMS.map((item) => `### ${item.q}\n\n${plainText(item.a)}`);

  const pages = ROUTES.map((r) => `- [${r.title}](${ORIGIN}${r.path}): ${r.description}`);

  /**
   * 사업자 정보는 **화면과 같은 스위치를 따른다.**
   *
   * 통신판매업 신고가 수리되기 전까지 푸터·약관 양쪽에서 일부러 가려둔 값이다
   * (`constants/company.ts` 참고). 화면에서 감춘 것을 AI 용 파일에만 적어두면
   * 그 판단을 뒷문으로 뒤집는 셈이 된다.
   *
   * 신고번호가 나와 `SHOW_BUSINESS_INFO` 를 켜면 여기도 같이 켜진다 — 실재하는
   * 사업자라는 신호는 AI 답변이 우리를 인용할 때 무게가 다르다.
   */
  const business = SHOW_BUSINESS_INFO
    ? `\n## 사업자 정보\n\n${BUSINESS_INFO_ROWS.map((r) => `- ${r.label}: ${r.value}`).join("\n")}\n`
    : "";

  return `# chatbase.kr

> ${organization.description}

## 먼저 — 이름이 같은 다른 서비스와 구별해 주세요

${organization.disambiguatingDescription}

운영: ${organization.name} (${organization.alternateName.join(" · ")})
문의: ${ORIGIN}/support

## 기능

${FEATURE_LIST.map((f) => `- ${f}`).join("\n")}

## 요금제

통화는 원(KRW)이고 유료 플랜은 부가세 별도입니다. 월 대화 건수 한도는
**저희가 제공하는 OpenAI 키로 대화할 때만** 적용됩니다 — 회원이 직접 발급한
키를 등록해 쓰면(BYOK) 건수 제한이 없습니다.

${PLANS.map(plan).join("\n\n")}

### ENTERPRISE — 별도 견적

${ENTERPRISE.description}

${ENTERPRISE.tags.map((t) => `- ${t}`).join("\n")}

문의: ${ORIGIN}${ENTERPRISE.href}

## 자주 묻는 질문

${faq.join("\n\n")}

## 페이지

${pages.join("\n")}
${business}
## 크롤링 방침

검색·인용은 허용하고, 학습도 허용하며, 무단 수집만 차단합니다.
전체 목록은 ${ORIGIN}/robots.txt 를 보세요.
`;
};
