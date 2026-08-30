import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Button from "@shared/ui/button";

const CTA = () => {
  return (
    <section className="border-b border-line min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
        <div className="rounded-image bg-text-main text-text-inverse px-8 md:px-16 py-16 md:py-20 text-center">
          <h2 className="text-[32px] md:text-[44px] font-semibold tracking-heading leading-tight">
            오늘 만들어, 오늘 배포.
          </h2>
          <p className="mt-4 text-[15px] md:text-[17px] opacity-70 max-w-2xl mx-auto leading-relaxed">
            계정 만드는 데 30초, 챗봇 만드는 데 30초. 카드 등록은 필요 없습니다.
          </p>
          <div className="mt-10">
            <Link to="/dashboard">
              <Button
                size="lg"
                pill
                variant="secondary"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                무료로 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
