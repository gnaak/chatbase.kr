import { LegalModalLink } from "@/component/landing/legalModal";

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

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-text-sub">
              <a href="#features" className="hover:text-text-main transition-colors">
                기능
              </a>
              <a href="#how" className="hover:text-text-main transition-colors">
                작동 방식
              </a>
              <a href="#pricing" className="hover:text-text-main transition-colors">
                가격
              </a>
              <a href="#faq" className="hover:text-text-main transition-colors">
                FAQ
              </a>
              <a href="/login" className="hover:text-text-main transition-colors">
                로그인
              </a>
            </div>
          </div>
        </div>
      </div>

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
