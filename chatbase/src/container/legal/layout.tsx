import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  children: ReactNode;
}

const LegalLayout = ({ title, effectiveDate, children }: LegalLayoutProps) => {
  return (
    <div className="min-h-svh bg-bg text-text-main">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-line">
        <div className="max-w-3xl mx-auto h-14 px-6 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-text-sub hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            chatbase.kr
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <div className="mb-10">
          <p className="font-mono text-[11px] uppercase tracking-tight text-text-sub mb-3">
            LEGAL
          </p>
          <h1 className="text-[32px] md:text-[40px] font-semibold tracking-heading leading-tight text-text-main">
            {title}
          </h1>
          <p className="mt-3 text-[12px] text-text-sub font-mono">
            시행일 · {effectiveDate}
          </p>
        </div>

        <article className="legal-prose">{children}</article>

        <footer className="mt-16 pt-6 border-t border-line text-[11px] text-text-sub flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/terms" className="hover:text-text-main">
            이용약관
          </Link>
          <Link to="/privacy" className="hover:text-text-main">
            개인정보처리방침
          </Link>
          <Link to="/support" className="hover:text-text-main">
            문의하기
          </Link>
          <a href="mailto:hello@chatbase.kr" className="hover:text-text-main">
            hello@chatbase.kr
          </a>
        </footer>
      </main>
    </div>
  );
};

export const Section = ({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) => (
  <section className="mt-10 first:mt-0">
    <h2 className="flex items-baseline gap-3 text-[18px] font-semibold tracking-tight text-text-main mb-3">
      <span className="font-mono text-[12px] text-text-sub">{number}</span>
      {title}
    </h2>
    <div className="text-[14px] text-text-main leading-[1.8] space-y-3">
      {children}
    </div>
  </section>
);

export const SubList = ({ items }: { items: ReactNode[] }) => (
  <ol className="list-decimal pl-5 space-y-1.5 text-text-sub">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ol>
);

export default LegalLayout;
