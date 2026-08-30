import { AlertTriangle } from "lucide-react";
import Button from "@shared/ui/button";

interface InactiveAccountModalProps {
  open: boolean;
  onConfirm: () => void;
  adminEmail?: string;
}

const InactiveAccountModal = ({
  open,
  onConfirm,
  adminEmail = "example@email.com",
}: InactiveAccountModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-comfy bg-bg-card shadow-card dark:shadow-card-dark p-6 flex flex-col items-center text-center animate-fade-slide">
        <div className="w-10 h-10 rounded-full bg-warning-bg flex items-center justify-center mb-4">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <h2 className="text-[15px] font-semibold tracking-tight text-text-main mb-1.5">
          현재 계정이 비활성화 상태입니다
        </h2>
        <p className="text-[12px] text-text-sub leading-relaxed mb-1">
          로그인 권한이 필요하신 경우 관리자에게 문의해 주세요.
        </p>
        <p className="text-[11px] text-text-sub font-mono mb-6">
          {adminEmail}
        </p>
        <Button size="sm" pill full onClick={onConfirm}>
          확인
        </Button>
      </div>
    </div>
  );
};

export default InactiveAccountModal;
