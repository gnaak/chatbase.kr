interface LoadingScreenProps {
  title?: string;
  description?: string;
}

const LoadingScreen = ({
  title = "로그인 처리 중",
  description = "잠시만 기다려주세요...",
}: LoadingScreenProps) => {
  return (
    <div className="min-h-svh bg-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Spinner />
        <div>
          <p className="text-[14px] font-medium text-text-main tracking-tight">
            {title}
          </p>
          <p className="text-[12px] text-text-sub mt-1">{description}</p>
        </div>
      </div>
    </div>
  );
};

export const Spinner = () => (
  <div
    className="
      w-8 h-8 rounded-full
      border-2 border-line
      border-t-text-main
      animate-spin
    "
    role="status"
    aria-label="로딩 중"
  />
);

export default LoadingScreen;
