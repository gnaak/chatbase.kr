import { CreditCard } from "lucide-react";

const AdminPayments = () => {
  return (
    <div className="px-6 md:px-8 py-6 flex flex-col gap-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-text-main">
          결제 관리
        </h1>
        <p className="text-[13px] text-text-sub mt-1">
          PMF 검증 후 토스페이먼츠 도입 예정.
        </p>
      </div>

      <div className="rounded-comfy bg-bg-card shadow-border px-6 py-16">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-sub flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-text-sub" />
          </div>
          <p className="text-[14px] font-medium text-text-main">
            아직 결제 기능이 없습니다.
          </p>
          <p className="text-[12px] text-text-sub max-w-md leading-relaxed">
            베타 무료 운영 중. 사용자 피드백/리텐션 검증이 끝나면 토스페이먼츠
            SDK + 사업자등록 절차를 진행한 뒤 이 페이지에 결제 내역, 구독 상태,
            환불 처리 UI가 추가됩니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;
