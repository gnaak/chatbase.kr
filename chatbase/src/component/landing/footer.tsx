import { Link } from "react-router-dom";

import { LegalModalLink } from "@/component/landing/legalModal";
import {
  BUSINESS_INFO_ROWS,
  FTC_LOOKUP_URL,
  SHOW_BUSINESS_INFO,
} from "@/constants/company";
import { INDUSTRIES } from "@/constants/industries";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer>
      {/* 메인 푸터 row */}
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="font-mono text-[14px] font-medium text-text-main">
                chatbase.kr
              </div>
              <p className="text-[12px] text-text-sub mt-1">
                고객 응대부터 사내 매뉴얼까지, 우리 자료로 답하는 AI 챗봇
              </p>
            </div>

            {/*
              앵커에 `/` 를 붙인다. 이 푸터는 랜딩 말고 업종 페이지에서도 쓰이는데,
              거기엔 #features 같은 섹션이 없어서 눌러도 아무 일이 안 일어났다.
              `/#features` 면 홈으로 이동한 뒤 그 섹션으로 간다 — 랜딩에서 누를 때는
              경로가 같으므로 그대로 앵커 스크롤만 된다.
            */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-text-sub">
              <a href="/#features" className="hover:text-text-main transition-colors">
                기능
              </a>
              <a href="/#how" className="hover:text-text-main transition-colors">
                작동 방식
              </a>
              <a href="/#pricing" className="hover:text-text-main transition-colors">
                가격
              </a>
              <a href="/#faq" className="hover:text-text-main transition-colors">
                FAQ
              </a>
              <a href="/login" className="hover:text-text-main transition-colors">
                로그인
              </a>
            </div>
          </div>
        </div>
      </div>

      {/*
        업종별 페이지 — sitemap 에만 있고 사이트 안에서 아무도 링크하지 않으면
        고아 페이지가 된다. 크롤러가 따라올 경로를 만들어 주는 자리다.
        목록은 `constants/industries.ts` 에서 온다.
      */}
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-6">
          <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-2.5">
            업종별
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-text-sub">
            {INDUSTRIES.map((industry) => (
              <li key={industry.slug}>
                <Link
                  to={`/for/${industry.slug}`}
                  className="hover:text-text-main transition-colors"
                >
                  {industry.name} 챗봇
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 사업자정보 row — 전자상거래법 제10조상 초기 화면 표시 의무.
          토스페이먼츠 빌링키 심사에서도 이 표기를 본다.
          통신판매업 신고 수리 전까지는 SHOW_BUSINESS_INFO로 꺼둔다. */}
      {SHOW_BUSINESS_INFO && (
        <div className="border-t border-line">
          <div className="max-w-7xl mx-auto px-6 md:px-8 py-6">
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] leading-relaxed text-text-sub">
              {BUSINESS_INFO_ROWS.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <dt>{label}</dt>
                  <dd className="text-text-main">{value}</dd>
                </div>
              ))}
            </dl>

            {FTC_LOOKUP_URL && (
              <a
                href={FTC_LOOKUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[11px] text-text-sub underline underline-offset-2 hover:text-text-main transition-colors"
              >
                사업자정보 확인
              </a>
            )}
          </div>
        </div>
      )}

      {/* 저작권 row — 보더가 페이지 끝까지 */}
      <div className="border-t border-line">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[11px] text-text-sub">
            <p>© {year} chatbase.kr. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <LegalModalLink
                type="terms"
                className="hover:text-text-main transition-colors"
              >
                이용약관
              </LegalModalLink>
              <LegalModalLink
                type="privacy"
                className="hover:text-text-main transition-colors"
              >
                개인정보처리방침
              </LegalModalLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
