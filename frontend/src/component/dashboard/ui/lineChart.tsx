import { useState } from "react";

/**
 * 인라인 SVG 꺾은선 차트.
 *
 * 차트 라이브러리를 넣지 않는 이유: 번들이 이미 700KB 단일 청크인데 recharts류는
 * 100KB 이상 더한다. 필요한 건 선 하나·점·격자·툴팁뿐이라 SVG로 직접 그린다.
 *
 * 색은 `currentColor`, 폰트는 Tailwind 클래스로 상속받는다.
 * SVG에 fontFamily를 인라인으로 박으면 프로젝트 폰트(Geist)를 무시한다.
 */

export interface LinePoint {
  /** x축 라벨 (짧게) */
  label: string;
  value: number;
  /** 툴팁에 쓸 전체 설명. 없으면 label */
  title?: string;
}

interface LineChartProps {
  points: LinePoint[];
  unit?: string;
  className?: string;
}

// viewBox 좌표계. 실제 크기는 CSS가 정하고 이 안에서 비율로 그린다.
const W = 600;
const H = 200;
const PAD = { top: 24, right: 12, bottom: 28, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** x축 라벨 최대 개수. 넘으면 균등하게 건너뛴다. */
const MAX_X_LABELS = 8;
/** 점 위에 숫자를 상시 표시하는 최대 개수. 넘으면 겹쳐서 못 읽는다. */
const MAX_VALUE_LABELS = 12;

/** 눈금이 3, 7 같은 어정쩡한 값이 되지 않게 위로 올림. */
const niceMax = (max: number): number => {
  if (max <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / mag) * mag;
};

const LineChart = ({ points, unit = "건", className }: LineChartProps) => {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="text-[13px] text-text-sub py-8 text-center">
        표시할 데이터가 없습니다.
      </p>
    );
  }

  const top = niceMax(Math.max(...points.map((p) => p.value)));
  const n = points.length;

  // 점이 하나면 나눗셈이 0이 되므로 가운데에 놓는다.
  const xOf = (i: number) =>
    n === 1 ? PAD.left + PLOT_W / 2 : PAD.left + (i * PLOT_W) / (n - 1);
  const yOf = (v: number) => PAD.top + PLOT_H * (1 - v / top);

  const coords = points.map((p, i) => ({ ...p, x: xOf(i), y: yOf(p.value) }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const baseline = PAD.top + PLOT_H;
  const area = `${coords[0].x},${baseline} ${line} ${
    coords[n - 1].x
  },${baseline}`;

  const labelStep = Math.ceil(n / MAX_X_LABELS);
  const showValues = n <= MAX_VALUE_LABELS;
  const active = hover !== null ? coords[hover] : null;

  // 툴팁이 좌우로 잘리지 않게 x를 안쪽으로 당긴다.
  const TIP_W = 96;
  const tipX = active
    ? Math.min(Math.max(active.x - TIP_W / 2, 2), W - TIP_W - 2)
    : 0;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full text-text-main"
        role="img"
        aria-label="기간별 질문 수 추이"
        onMouseLeave={() => setHover(null)}
      >
        {/* 가로 격자 + y축 값 */}
        {[0, 0.5, 1].map((ratio) => {
          const y = PAD.top + PLOT_H * (1 - ratio);
          return (
            <g key={ratio}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={ratio === 0 ? 0.25 : 0.1}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-text-sub font-mono text-[9px]"
              >
                {Math.round(top * ratio)}
              </text>
            </g>
          );
        })}

        <polygon points={area} fill="currentColor" fillOpacity={0.08} />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.85}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* hover 중인 지점의 세로 안내선 */}
        {active && (
          <line
            x1={active.x}
            y1={PAD.top}
            x2={active.x}
            y2={baseline}
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* 점 + 상시 값 라벨 */}
        {coords.map((c, i) => (
          <g key={c.label + i}>
            {showValues && c.value > 0 && hover === null && (
              <text
                x={c.x}
                y={c.y - 8}
                textAnchor="middle"
                className="fill-text-main text-[9px] font-semibold"
              >
                {c.value}
              </text>
            )}
            <circle
              cx={c.x}
              cy={c.y}
              r={hover === i ? 4 : n > 30 ? 1.5 : 2.5}
              fill="currentColor"
            />

            {/* x축 라벨 — 첫·마지막은 항상 보여준다 */}
            {(i % labelStep === 0 || i === n - 1) && (
              <text
                x={c.x}
                y={H - 9}
                textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                className="fill-text-sub font-mono text-[9px]"
              >
                {c.label}
              </text>
            )}
          </g>
        ))}

        {/*
          hover 감지용 투명 막대. 점에만 걸면 마우스를 정확히 맞춰야 해서
          거의 안 잡힌다. 구간 전체를 세로로 덮어 어디에 올려도 잡히게 한다.
          맨 위에 둬야 다른 요소에 가려지지 않는다.
        */}
        {coords.map((c, i) => {
          const half = n === 1 ? PLOT_W / 2 : PLOT_W / (n - 1) / 2;
          return (
            <rect
              key={`hit-${i}`}
              x={c.x - half}
              y={PAD.top}
              width={half * 2}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          );
        })}

        {/* 툴팁 */}
        {active && (
          <g pointerEvents="none">
            <rect
              x={tipX}
              y={2}
              width={TIP_W}
              height={18}
              rx={4}
              className="fill-bg-card"
              stroke="currentColor"
              strokeOpacity={0.15}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={tipX + TIP_W / 2}
              y={14}
              textAnchor="middle"
              className="fill-text-main text-[10px]"
            >
              {`${active.title ?? active.label} · ${active.value}${unit}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export default LineChart;
