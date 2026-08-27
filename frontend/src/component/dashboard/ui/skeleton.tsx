interface SkeletonProps {
  /** 크기·모양은 전부 className으로 지정한다 (예: "h-4 w-32 rounded-full"). */
  className?: string;
}

/**
 * 데이터가 도착하기 전 자리를 대신 차지하는 회색 블록.
 *
 * 실제 콘텐츠와 **같은 높이**로 잡아야 데이터가 들어올 때 레이아웃이 튀지 않는다.
 * 값을 모르는 상태에서 0이나 "FREE" 같은 기본값을 먼저 그리면 깜빡임이 되므로,
 * 그런 자리에는 기본값 대신 이 컴포넌트를 넣는다.
 */
const Skeleton = ({ className = "" }: SkeletonProps) => (
  <div
    aria-hidden="true"
    className={[
      "relative overflow-hidden bg-skeleton-base rounded-DEFAULT",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <div
      className="
        absolute inset-0 -translate-x-full
        bg-gradient-to-r from-transparent via-skeleton-shine to-transparent
        animate-shimmer motion-reduce:animate-none
      "
    />
  </div>
);

export default Skeleton;
