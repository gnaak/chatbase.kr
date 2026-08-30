interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 스크린리더용 이름. `Field` 의 label 은 시각 요소라 여기 따로 준다. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * 온/오프 스위치.
 *
 * 손잡이를 `absolute` + `translate-x-[22px]` 같은 매직 넘버로 밀지 않는다.
 * 트랙에 `p-0.5` 를 주고 손잡이를 흐름 안에 두면, 이동 거리가
 * `트랙 44 - 패딩 4 - 손잡이 20 = 20px` 로 딱 떨어져 `translate-x-5` 하나로 끝난다.
 * 크기를 바꿔도 계산이 안 어긋난다.
 *
 * 켜짐 색은 `bg-primary` 다. `bg-main` 계열은 어두운 배경 토큰이라 다크 모드에서
 * 트랙이 배경과 붙어버린다. `primary` 는 테마에 따라 반전되므로 양쪽에서 대비가 산다.
 */
const Toggle = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={[
      "relative inline-flex shrink-0 items-center h-6 w-11 p-0.5 rounded-full",
      "transition-colors duration-150",
      "focus:outline-none focus-visible:shadow-focus",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      checked ? "bg-primary" : "bg-bg-active shadow-border",
      className,
    ].join(" ")}
  >
    <span
      className={[
        "block h-5 w-5 rounded-full bg-bg-card shadow-border",
        "transition-transform duration-150",
        checked ? "translate-x-5" : "translate-x-0",
      ].join(" ")}
    />
  </button>
);

export default Toggle;
