import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Button from "@shared/ui/button";

const NotFoundPage = () => {
  return (
    <div className="min-h-svh bg-bg text-text-main flex flex-col items-center justify-center px-6 py-12">
      <div className="text-center flex flex-col items-center gap-5 max-w-md">
        <span className="font-mono text-[12px] uppercase tracking-tight text-text-sub">
          404 · NOT FOUND
        </span>

        <h1 className="text-[44px] md:text-[56px] font-semibold tracking-display leading-tight text-text-main">
          페이지를 찾을 수 없어요.
        </h1>

        <p className="text-[14px] text-text-sub leading-relaxed">
          찾으시는 페이지가 삭제되었거나, 주소가 변경되었거나, 처음부터 없었던
          페이지일 수 있습니다.
        </p>

        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <Link to="/">
            <Button pill leftIcon={<ArrowLeft className="w-4 h-4" />}>
              홈으로 돌아가기
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button pill variant="secondary">
              대시보드
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
